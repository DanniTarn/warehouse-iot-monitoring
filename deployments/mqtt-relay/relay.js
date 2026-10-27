const mqtt = require('mqtt')

const localUrl = process.env.LOCAL_URL || 'mqtt://mosquitto:1883'
const remoteUrl = process.env.REMOTE_URL || 'mqtt://broker.hivemq.com:1883'
const topic = process.env.TOPIC || 'khohang/#'
const loopWindow = 5000

const seen = new Map()

function remember(topicName, payload) {
  const key = `${topicName}\u0000${payload.toString()}`
  const now = Date.now()
  for (const [entry, at] of seen) if (now - at > loopWindow) seen.delete(entry)
  if (seen.has(key)) return false
  seen.set(key, now)
  return true
}

const local = mqtt.connect(localUrl, {
  clientId: `warehouse-relay-local-${process.pid}`,
  reconnectPeriod: 2000,
})
const remote = mqtt.connect(remoteUrl, {
  clientId: `warehouse-relay-remote-${process.pid}`,
  reconnectPeriod: 2000,
})

function wire(source, target, sourceName) {
  source.on('connect', () => {
    console.log(`relay connected to ${sourceName}`)
    source.subscribe(topic, { qos: 1 }, (error) => {
      if (error) console.error(`relay subscribe failed on ${sourceName}:`, error.message)
    })
  })
  source.on('error', (error) => console.error(`relay ${sourceName} error:`, error.message))
  source.on('message', (topicName, payload) => {
    if (!remember(topicName, payload)) return
    target.publish(topicName, payload, { qos: 1 })
  })
}

wire(remote, local, 'public broker')
wire(local, remote, 'local broker')
