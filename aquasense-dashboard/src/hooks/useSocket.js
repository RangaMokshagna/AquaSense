import { useEffect, useRef, useState, useCallback } from 'react'
import { io } from 'socket.io-client'

export function useSocket(deviceId = null) {
  const socketRef = useRef(null)
  const [connected, setConnected]     = useState(false)
  const [lastUpdate, setLastUpdate]   = useState(null)
  const [liveReading, setLiveReading] = useState(null)
  const [liveAlerts, setLiveAlerts]   = useState([])

  useEffect(() => {
    const socket = io('/', {
      transports: ['websocket', 'polling'],
      reconnectionDelay: 2000,
      reconnectionAttempts: 10,
    })
    socketRef.current = socket

    socket.on('connect',    () => setConnected(true))
    socket.on('disconnect', () => setConnected(false))

    if (deviceId) {
      socket.emit('subscribe_device', deviceId)
      socket.on('device_update', ({ reading, prediction, alerts }) => {
        setLiveReading({ reading, prediction })
        setLastUpdate(new Date())
        if (alerts?.length > 0) {
          setLiveAlerts(prev => [...alerts, ...prev].slice(0, 50))
        }
      })
    } else {
      socket.on('sensor_update', ({ reading, prediction, alerts }) => {
        setLiveReading({ reading, prediction })
        setLastUpdate(new Date())
        if (alerts?.length > 0) {
          setLiveAlerts(prev => [...alerts, ...prev].slice(0, 50))
        }
      })
    }

    socket.on('alert', (alert) => {
      setLiveAlerts(prev => [alert, ...prev].slice(0, 50))
    })

    return () => socket.disconnect()
  }, [deviceId])

  const clearAlerts = useCallback(() => setLiveAlerts([]), [])

  return { connected, lastUpdate, liveReading, liveAlerts, clearAlerts }
}
