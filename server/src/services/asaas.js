const BASE_SANDBOX = 'https://sandbox.asaas.com/api/v3'
const BASE_PROD = 'https://www.asaas.com/api/v3'

function baseUrl() {
  return process.env.NODE_ENV === 'production' ? BASE_PROD : BASE_SANDBOX
}

async function req(apiKey, method, path, body) {
  const res = await fetch(`${baseUrl()}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', access_token: apiKey },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data?.errors?.[0]?.description || `Asaas ${res.status}`)
  return data
}

export async function findOrCreateCustomer(apiKey, { name, email, phone }) {
  const search = await req(apiKey, 'GET', `/customers?email=${encodeURIComponent(email)}&limit=1`)
  if (search.data?.length > 0) return search.data[0]
  return req(apiKey, 'POST', '/customers', { name, email, mobilePhone: phone })
}

export async function createPaymentLink(apiKey, { customerId, amount, description, dueDate }) {
  return req(apiKey, 'POST', '/payments', {
    customer: customerId,
    billingType: 'UNDEFINED', // aceita PIX, boleto e cartão
    value: Number(amount.toFixed(2)),
    dueDate,
    description,
    externalReference: description,
  })
}
