import { Transform } from 'stream'
import { Logtail } from '@logtail/node'
import { Context, ILogtailOptions, LogLevel, StackContextHint } from '@logtail/types'
import { getLogLevel } from './helpers'
import os from 'os'
import  pino  from 'pino'

export interface IPinoLogtailOptions {
  sourceToken: string
  options: Partial<ILogtailOptions>
}

const stackContextHint = {
  fileName: 'node_modules/pino',
  methodNames: ['log', 'fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'],
  required: true,
}

export function logtailTransport() {
  const options: IPinoLogtailOptions = {
    sourceToken: process.env.LOGTAIL_SOURCE_TOKEN || 'B5p5aFX1cPDdGdzaKHFu1Vss',
    options: {
      endpoint: 'https://s1214463.eu-nbg-2.betterstackdata.com',
    },
  }
  const logtail = new Logtail(options.sourceToken, options.options)
  const write = async (obj: any) => {
    const object = JSON.parse(obj)
    const meta: Context = {}

    if (typeof object.time === 'string' || object.time) {
      const time = new Date(object.time)
      if (!isNaN(time.valueOf())) {
        meta.dt = time
      }
    }

    Object.keys(object)
      .filter((key) => ['time', 'msg', 'message', 'level', 'v'].indexOf(key) < 0)
      .forEach((key) => (meta[key] = object[key]))
    const msg = object.msg
    if (object.msg !== undefined && object.message !== undefined) {
      meta['message_field'] = object.message
    }

    let level: LogLevel
    try {
      level = getLogLevel(object.level)
    } catch (_) {
      console.error('Error while mapping log level.')
      return
    }

    logtail.log(msg, level, meta, stackContextHint as StackContextHint)
    await logtail.flush()
  }

  return new Transform({
    objectMode: true,
    transform(chunk, encoding, callback) {
      write(chunk).then(() => callback())
    },
  })
}

export function createPinoBaseConfig() {
  let username
  try {
    username = os.userInfo().username
  } catch (error) {
    username = process.env.USER || process.env.USERNAME || 'unknown'
  }

  return {
    base: {
      user: username,
      hostname: os.hostname(), // Adds the computer name to every log
      env: process.env.NODE_ENV || 'development', // Optionally include NODE_ENV
    },
    level: process.env.LOG_LEVEL || 'debug',
  }
}

// Create and export the logger instance
const baseConfig = createPinoBaseConfig()
const streams = [
  { level: 'info', stream: logtailTransport() },
  { level: 'info', stream: process.stdout },
]
export const logger = pino(baseConfig, pino.multistream(streams))
