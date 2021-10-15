const express = require('express')
const morgan = require('morgan')
const cors = require('cors')
const mongoose = require('mongoose')
require('dotenv').config()
const history = require('connect-history-api-fallback')

const app = express()

const morgan_settings = morgan((tokens, req, res) => {
  return [
    tokens.method(req, res),
    tokens.url(req, res),
    tokens.status(req, res),
    tokens.res(req, res, 'content-length'), '-',
    tokens['response-time'](req, res), 'ms'
  ].join(' ')
})

const mongo_url = process.env.MONGODB_URI
console.log('connecting to', mongo_url)

mongoose.connect(mongo_url, { useNewUrlParser: true, useUnifiedTopology: true }).then(() => {
  console.log('connected to MongoDB')
}).catch(error => {
  console.log('error connecting to MongoDB:', error.message)
})

const characterSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    minLength: 3
  },
  attributes: { type: Map, of: String }
})

characterSchema.set('toJSON', {
  transform: (document, returnedObject) => {
    returnedObject.id = returnedObject._id.toString()
    delete returnedObject._id
    delete returnedObject.__v
  }
})
const Character = mongoose.model('Character', characterSchema)

app.use(express.json())
app.use(history())
app.use(express.static('build'))
app.use(morgan_settings)
app.use(cors())

app.post('/api/characters', async (req, resp, next) => {
  const character = new Character({ name: req.body.name })

  try {
    const savedCharacter = await character.save()
    resp.status(200).json(savedCharacter)
  }
  catch (error) {
    next(error)
  }
})

app.get('/api/characters/:id', async (req, resp, next) => {
  const id = req.params.id

  try {
    const character = await Character.findById(id)

    resp.status(200).json(character)
  }
  catch (error) {
    next(error)
  }
})

app.put('/api/characters/:id', async (req, resp, next) => {
  const id = req.params.id
  const character = Character.findById(id)

  console.log('updating character:', req.body)

  try {
    const character = await Character.findByIdAndUpdate(id, req.body)

    resp.status(200).json(character)
  }
  catch (error) {
    next(error)
  }
})

const unknownEndpoint = (req, resp, next) => {
  console.log(req)
  resp.status(404).send({ error: 'unknown endpoint' })
  next()
}

const errorHandler = (error, req, resp, next) => {
  console.log(error.message)

  //Neither errormessage is making it to the frontend, I'm just getting 'Request failed with status code 400'
  if (error.name === 'CastError') {
    return resp.status(400).send({ error: 'Non-existing or malformatted id' })
  }
  else if ( error.name === 'ValidationError') {
    return resp.status(400).send({ error: error.message })
  }
  next(error)
}

app.use(unknownEndpoint)
app.use(errorHandler)

const PORT = process.env.PORT
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})
