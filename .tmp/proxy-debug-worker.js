import { fetchTranscript } from 'youtube-transcript/dist/youtube-transcript.esm.js'

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8'
    }
  })
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error)
}

async function timed(label, fn) {
  const startedAt = Date.now()

  try {
    const result = await fn()
    return {
      ok: true,
      label,
      ms: Date.now() - startedAt,
      result
    }
  } catch (error) {
    return {
      ok: false,
      label,
      ms: Date.now() - startedAt,
      error: errorMessage(error)
    }
  }
}

async function withTimeout(label, timeoutMs, fn) {
  let timeoutId

  try {
    return await Promise.race([
      fn(),
      new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error(`${label} timed out after ${timeoutMs}ms`))
        }, timeoutMs)
      })
    ])
  } finally {
    clearTimeout(timeoutId)
  }
}

async function probeFetch(target, {
  method = 'GET',
  redirect = 'follow',
  readBody = true,
  timeoutMs = 8000,
  headers = {}
} = {}) {
  const startedAt = Date.now()
  const phases = []

  try {
    phases.push({ phase: 'start', at: 0, method, redirect })

    const response = await withTimeout('fetch', timeoutMs, () => fetch(target, {
      method,
      redirect,
      headers
    }))

    phases.push({
      phase: 'headers',
      at: Date.now() - startedAt,
      status: response.status,
      redirected: response.redirected,
      url: response.url,
      location: response.headers.get('location'),
      contentType: response.headers.get('content-type'),
      server: response.headers.get('server')
    })

    let bodyPreview = null
    if (readBody) {
      const text = await withTimeout('body', timeoutMs, () => response.text())
      bodyPreview = text.slice(0, 300)
      phases.push({
        phase: 'body',
        at: Date.now() - startedAt,
        length: text.length
      })
    }

    return {
      ok: true,
      target,
      ms: Date.now() - startedAt,
      phases,
      bodyPreview
    }
  } catch (error) {
    return {
      ok: false,
      target,
      ms: Date.now() - startedAt,
      phases,
      error: errorMessage(error)
    }
  }
}

export default {
  async fetch(request) {
    const url = new URL(request.url)
    const videoId = url.searchParams.get('videoId') || 'xRh2sVcNXQ8'

    if (url.pathname === '/probe') {
      const target = url.searchParams.get('target')
      if (!target) {
        return json({ ok: false, error: 'missing target' }, 400)
      }

      const readBody = url.searchParams.get('readBody') !== '0'
      const redirect = url.searchParams.get('redirect') || 'follow'
      const method = url.searchParams.get('method') || 'GET'
      const timeoutMs = Number(url.searchParams.get('timeoutMs') || '8000')
      const headers = {}

      if (url.searchParams.get('ua') === 'browser') {
        headers['user-agent'] = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36'
        headers.accept = 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        headers['accept-language'] = 'en-US,en;q=0.9'
      }

      const output = await probeFetch(target, {
        method,
        redirect,
        readBody,
        timeoutMs,
        headers
      })

      return json(output, output.ok ? 200 : 500)
    }

    if (url.pathname === '/matrix') {
      const targets = [
        'https://example.com',
        'https://www.google.com',
        'https://www.youtube.com/robots.txt',
        `https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}&format=json`,
        `https://www.youtube.com/watch?v=${videoId}`
      ]

      const output = await Promise.all(targets.map((target) => probeFetch(target)))
      return json({ ok: true, videoId, output })
    }

    if (url.pathname === '/watch') {
      const output = await timed('watch', async () => {
        const resp = await fetch(`https://www.youtube.com/watch?v=${videoId}`)
        const text = await resp.text()
        return {
          status: resp.status,
          length: text.length,
          includesPlayerResponse: text.includes('ytInitialPlayerResponse')
        }
      })

      return json(output, output.ok ? 200 : 500)
    }

    if (url.pathname === '/oembed') {
      const output = await timed('oembed', async () => {
        const endpoint = new URL('https://www.youtube.com/oembed')
        endpoint.searchParams.set('url', `https://www.youtube.com/watch?v=${videoId}`)
        endpoint.searchParams.set('format', 'json')
        const resp = await fetch(endpoint)
        const text = await resp.text()
        return {
          status: resp.status,
          body: text.slice(0, 300)
        }
      })

      return json(output, output.ok ? 200 : 500)
    }

    if (url.pathname === '/example') {
      const output = await timed('example', async () => {
        const resp = await fetch('https://example.com')
        const text = await resp.text()
        return {
          status: resp.status,
          length: text.length
        }
      })

      return json(output, output.ok ? 200 : 500)
    }

    if (url.pathname === '/httpbin') {
      const output = await timed('httpbin', async () => {
        const resp = await fetch('http://httpbin.org/get')
        const text = await resp.text()
        return {
          status: resp.status,
          body: text.slice(0, 300)
        }
      })

      return json(output, output.ok ? 200 : 500)
    }

    if (url.pathname === '/transcript') {
      const output = await timed('transcript', async () => {
        const transcript = await fetchTranscript(videoId, { lang: 'en' })
        return {
          count: transcript.length,
          first: transcript[0] ?? null
        }
      })

      return json(output, output.ok ? 200 : 500)
    }

    return json({
      ok: true,
      routes: ['/example', '/httpbin', '/watch', '/oembed', '/probe', '/matrix', '/transcript'],
      videoId
    })
  }
}
