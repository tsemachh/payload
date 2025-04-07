import { Transform } from 'stream'
import { Logtail } from '@logtail/node'
import { Context, LogLevel, ILogtailOptions, StackContextHint } from '@logtail/types'
import { getLogLevel } from './helpers'

export interface IPinoLogtailOptions {
  sourceToken: string
  options: Partial<ILogtailOptions>
}

const stackContextHint = {
  fileName: 'node_modules/pino',
  methodNames: ['log', 'fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'],
  required: true,
}

export function logtailTransport(options: IPinoLogtailOptions) {
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

  const stream = new Transform({
    objectMode: true,
    transform(chunk, encoding, callback) {
      write(chunk).then(() => callback())
    },
  })

  return stream
}
