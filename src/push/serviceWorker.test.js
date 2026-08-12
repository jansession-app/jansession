import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { describe, expect, it } from 'vitest'

describe('push notification click', () => {
  it('uses the event tag when showing a notification', async () => {
    const listeners = new Map()
    const shown = []
    const source = readFileSync(new URL('../../public/sw.js', import.meta.url), 'utf8')
    const context = {
      URL,
      self: {
        location: { origin: 'https://jansession-app.github.io' },
        registration: {
          scope: 'https://jansession-app.github.io/jansession/',
          showNotification: async (title, options) => { shown.push({ title, options }) },
        },
        clients: { matchAll: async () => [] },
        addEventListener: (type, listener) => { listeners.set(type, listener) },
      },
    }
    vm.runInNewContext(source, context)
    let completion
    listeners.get('push')({
      data: { json: () => ({ title: 'JanSession', body: 'Test', tag: 'jansession:event-one', url: '/jansession/#/jams' }) },
      waitUntil(promise) { completion = promise },
    })
    await completion
    expect(shown[0].options.tag).toBe('jansession:event-one')
  })

  it('opens the JanSession jams route', async () => {
    const listeners = new Map()
    const opened = []
    const source = readFileSync(new URL('../../public/sw.js', import.meta.url), 'utf8')
    const context = {
      URL,
      self: {
        location: { origin: 'https://jansession-app.github.io' },
        registration: { scope: 'https://jansession-app.github.io/jansession/' },
        clients: {
          matchAll: async () => [],
          openWindow: async (url) => { opened.push(url) },
        },
        addEventListener: (type, listener) => { listeners.set(type, listener) },
      },
    }
    vm.runInNewContext(source, context)
    let completion
    listeners.get('notificationclick')({
      notification: { data: { url: '/jansession/#/jams' }, close() {} },
      waitUntil(promise) { completion = promise },
    })
    await completion
    expect(opened).toEqual(['https://jansession-app.github.io/jansession/#/jams'])
  })

  it('navigates and focuses an existing JanSession window', async () => {
    const listeners = new Map()
    const navigated = []
    let focused = false
    const existingClient = {
      url: 'https://jansession-app.github.io/jansession/#/profile',
      async navigate(url) { navigated.push(url); this.url = url; return this },
      async focus() { focused = true; return this },
    }
    const source = readFileSync(new URL('../../public/sw.js', import.meta.url), 'utf8')
    const context = {
      URL,
      self: {
        location: { origin: 'https://jansession-app.github.io' },
        registration: { scope: 'https://jansession-app.github.io/jansession/' },
        clients: {
          matchAll: async () => [existingClient],
          openWindow: async () => { throw new Error('A new window should not be opened') },
        },
        addEventListener: (type, listener) => { listeners.set(type, listener) },
      },
    }
    vm.runInNewContext(source, context)
    let completion
    listeners.get('notificationclick')({
      notification: { data: { url: '/jansession/#/jams' }, close() {} },
      waitUntil(promise) { completion = promise },
    })
    await completion
    expect(navigated).toEqual(['https://jansession-app.github.io/jansession/#/jams'])
    expect(focused).toBe(true)
  })
})
