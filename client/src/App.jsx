import { useEffect, useState } from 'react'

function App() {
  const [message, setMessage] = useState('')

  useEffect(() => {
    fetch('/api/hello')
      .then((res) => res.json())
      .then((data) => setMessage(data.message))
      .catch(() => setMessage('Erro ao conectar com a API'))
  }, [])

  return (
    <div>
      <h1>AgendarAdvBR</h1>
      <p>API: {message || 'Carregando...'}</p>
    </div>
  )
}

export default App
