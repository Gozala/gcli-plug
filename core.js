/* vim:set ts=2 sw=2 sts=2 expandtab */
/*jshint asi: true es5: true node: true devel: true */
define(function(require, exports, module) {
  'use strict';

  var gcli = require('gcli/index')
  var types = require('gcli/types')
  var StringType = require('gcli/types/basic').StringType
  var SelectionType = require('gcli/types/basic').SelectionType
  var Status = require('gcli/types').Status
  var Conversion = require('gcli/types').Conversion
  var Argument = require('gcli/argument').Argument
  var hub = require('plugin-hub/core'), meta = hub.meta, values = meta.values

  exports.name = 'gcli-plug'
  exports.version = '0.0.1'
  exports.author = 'Irakli Gozalishvili <rfobic@gmail.com>'
  exports.description = 'Adapter plguin for GCLI'
  exports.stability = 'unstable'

  var unbind = Function.call.bind(Function.bind, Function.call)
  var owns = unbind(Object.prototype.hasOwnProperty)

  // Utility helper function to make interactions with GCLI promises just
  // a little bit more saner.
  function when(value, resolve, reject) {
    return value && typeof(value.then) === 'function' ?
        value.then(resolve, reject) : resolve(value)
  }

  function TextType() {
    return StringType.apply(this, arguments)
  }
  TextType.prototype = Object.create(StringType.prototype)
  TextType.prototype.name = 'text'
  exports.types = {
    text: TextType
  }

  var type = meta('Utilities for working with types', exports.type = {})
  type.make = meta('Generates type for GCLI', function make(descriptor) {
    var type
    if (Array.isArray(descriptor)) {
      type = new SelectionType({
        name: descriptor.meta && descriptor.meta.name,
        data: descriptor
      })
    }

    if (typeof(descriptor) === 'function') {
      if (descriptor.meta && descriptor.meta.type === 'selection') {
        type = new SelectionType({
          name: descriptor.meta && descriptor.meta.name,
          data: descriptor
        })
      }
      else if (descriptor.meta) {
        type = function type() {}
        type.prototype = Object.create(types.Type.prototype)
        type.prototype.name = descriptor.meta.name || descriptor.name
        type.prototype.stringify = String
        type.prototype.parse = function parse(input) {
          var result, values = descriptor(input.text)
          if (Array.isArray(values) && values.length > 1)
            result = new Conversion(values[0], input, Status.INCOMPLETE, '', values)
          else if (!values)
            result = new Conversion(null, input, Status.ERROR, '', [])
          else
            result = new Conversion(values, input, Status.VALID)

          return result
        }
        type.prototype.defaultValue = function defaultValue() {
          var result = descriptor()
          return Array.isArray(result) ? result[0] : result
        }
      }
    }

    if (typeof(descriptor) === 'objects' && descriptor) {
      type = new SelectionType({
        name: descriptor.meta && descriptor.meta.name,
        lookup: function lookup() {
          return Object.keys(descriptor).
            filter(function(name) { return name !== 'meta' }).
            map(function(name) {
              return { name: name, value: descriptor[name] }
            })
        }
      })
    }

    return type
  })
  type.plug = meta('Plug in the type', function plug(env, descriptor) {
    descriptor.plug = descriptor.meta ? type.make(descriptor) : descriptor
    return types.registerType(descriptor.plug)
  })
  type.plug.all = meta('Plug all the given types', function unplug(env, types) {
    return types && Object.keys(types).map(function(name) {
      var item = types[name]
      if (!owns(item, 'name')) item.name = name
      if (item.meta && !owns(item.meta, 'name')) item.meta.name = name
      return type.plug(env, item)
    })
  })
  type.unplug = meta('Uplug the type', function unplug(env, type) {
    return types.unregisterType(type.plug)
  })
  type.unplug.all = meta('Unplug all the types', function unplug(env, types) {
    return values(types).map(function(name) {
      var item = types[name]
      if (!owns(item, 'name')) item.name = name
      return type.unplug(env, item)
    })
  })

  var command = meta('Utilities for working with command', exports.command = {})
  command.params = meta({
    description: 'Generates paramater signature'
  }, function params(env, signature) {
    var result = []

    if (Array.isArray(signature)) {
      result = signature.map(function(_, index) {
        var param = typeof(_) === 'string' ? { type: _ } : _
        param.name = String(index)
        return param
      })
    }

    if (typeof(signature) === 'number')
      while (signature) result.unshift({ name: signature -- })

    return result
  })
  command.make = meta({
    description: 'Generates command from a normal function'
  }, function make(env, name, f) {
    return {
      name: name,
      description: f.meta.description,
      params: command.params(env, f.meta.takes || f.length),
      exec: function execute(params, context) {
        var args = []
        for (var index in params) args[index] = params[index]
        var deferred = context.createPromise()
        when(f.apply(context, args),
             deferred.resolve.bind(deferred),
             deferred.reject.bind(deferred))
        return deferred
      }
    }
  })
  command.plug = meta({
    description: 'Plugs in the command'
  }, function plug(env, name, f) {
    var commands = env.gcliCommands
    if (f.meta) commands[name] = command.make(env, name, f)
    else commands[name] = Object.defineProperties(f, { name: { value: name }})
    return gcli.addCommand(commands[name])
  })
  command.unplug = meta({
    description: 'Unplugs given command'
  }, function unplug(env, name) {
    var command = env.gcliCommands && env.gcliCommands[name]
    return command && gcli.removeCommand(command)
  })

  var plugin = meta('Utils for type / command plugs', exports.plugin = {})
  plugin.plug = meta('Plugs plugin commands & types', function plug(env, plugin) {
    return plugin.types && type.plug.all(env, plugin.types)
  })
  plugin.unplug = meta('Unplugs commands & types', function unplug(env, plugin) {
    return plugin.types && type.unplug.all(env, plugin.types)
  })

  exports.onstartup = meta({
    description: 'Hook that registers all plugin commands & types'
  }, function onstartup(env, plugins) {
    env.gcliCommands = Object.create(null)
    plugins.forEach(plugin.plug.bind(plugin.plug, env))
    env.gcli = gcli
    gcli.options = {
      blurDelay: 10,
      outputHeight: 300,
      useFocusManager: true,
      environment: env
    }
    gcli.createView(gcli.options)
    var display = gcli.display = gcli.options.display

    var inputView = display.inputter.element
    display.focusManager.addMonitoredElement(inputView)
    var outputView = display.outputList.element
    outputView.tabIndex = 0
    display.focusManager.addMonitoredElement(outputView)
    var menuView = display.menu.element
    menuView.tabIndex = 0
    display.focusManager.addMonitoredElement(menuView)

    display.hide()
 })

  exports.onshutdown = meta({
    description: 'Hook that unregisters unplugged add-on commands & types'
  }, function onshutdown(env) {
    delete env.gcli
    // TODO: Find a way how to destroy a view.
  })

  exports.onplug = plugin.plug
  exports.onunplug = plugin.unplug
  exports['oncommand:plug'] = command.plug
  exports['oncommand:group:plug'] = command.plug
  exports['oncommand:unplug'] = command.unplug
  exports['oncommand:group:unplug'] = command.unplug

});

