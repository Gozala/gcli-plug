/* vim:set ts=2 sw=2 sts=2 expandtab */
/*jshint asi: true es5: true node: true devel: true */
define(function(require, exports, module) {
  'use strict';

  var gcli = require('gcli/index')
  var types = require('gcli/types')
  var StringType = require('gcli/types/basic').StringType

  exports.name = 'gcli-plug'
  exports.version = '0.0.1'
  exports.author = 'Irakli Gozalishvili <rfobic@gmail.com>'
  exports.description = 'Adapter plguin for GCLI'
  exports.stability = 'unstable'

  function TextType() {
    return StringType.apply(this, arguments)
  }
  TextType.prototype = Object.create(StringType.prototype)
  TextType.prototype.name = 'text'
  exports.types = {
    text: TextType
  }

  function meta(metadata, value) {
    value.meta = typeof(metadata) === 'string' ? { description: metadata }
                                               : metadata
    return value
  }

  function values(object) {
    return Object.keys(object).map(function(key) { return object[key] })
  }

  var type = meta('Utilities for working with types', exports.type = {})
  type.plug = meta('Plug in the type', function plug(type) {
    return types.registerType(type)
  })
  type.plug.all = meta('Plug all the given types', function unplug(types) {
    return types && Object.keys(types).map(function(name) {
      var item = types[name]
      if (!item.name) item.name = name
      return type.plug(item)
    })
  })
  type.unplug = meta('Uplug the type', function unplug(type) {
    return types.unregisterType(type)
  })
  type.unplug.all = meta('Unplug all the types', function unplug(types) {
    return types && values(types).map(function(name) {
      var item = types[name]
      if (!item.name) item.name = name
      return type.unplug(item)
    })
  })

  var command = meta('Utilities for working with command', exports.command = {})
  command.plug = meta('Plugs in the command', function plug(command) {
    return gcli.addCommand(command)
  })
  command.plug.all = meta('Plugs in all commands', function plug(commands) {
    return commands && Object.keys(commands).map(function(name) {
      var item = commands[name]
      if (!item.name) item.name = name
      return command.plug(item)
    })
  })
  command.unplug = meta('Unplugs given command', function unplug(command) {
    return gcli.removeCommand(command)
  })
  command.unplug.all = meta('Unplugs all commands', function unplug(commands) {
    return commands && values(commands).map(function(name) {
      var item = commands[name]
      if (!item.name) item.name = name
      return command.unplug(item)
    })
  })

  var plugin = meta('Utils for type / command plugs', exports.plugin = {})
  plugin.plug = meta('Plugs plugin commands & types', function plug(plugin) {
    type.plug.all(plugin.types)
    command.plug.all(plugin.commands)
  })
  plugin.unplug = meta('Unplugs commands & types', function unplug(plugin) {
    type.unplug.all(plugin.types)
    command.unplug.all(plugin.commands)
  })

  exports.onstartup = meta({
    description: 'Hook that registers all plugin commands & types'
  }, function onstartup(event) {
    event.plugins.forEach(plugin.plug)
    event.env.gcli = gcli
    gcli.options = { blurDelay: 10, outputHeight: 300, useFocusManager: true }
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
  }, function onshutdown(event) {
    delete event.env.gcli
    // TODO: Find a way how to destroy a view.
  })

 exports.onplug = meta({
    description: 'Hook that registers each plugin commands & types'
  }, function onplug(event) {
    plugin.plug(event.plugin)
  })

  exports.onunplug = meta({
    description: 'Hook that unregisters unplugged add-on commands & types'
  }, function onshutdown(event) {
    plugin.unplug(event.plugin)
  })

});

