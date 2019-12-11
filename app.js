const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');

/* Make enviropnment variables from the dotenv file available */
require('dotenv').config();

/* Initialize express */
const app = express();

/* Set up middlewares & application configuration */
app.use(cors());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

/* API routes */
app.use(require('./src/routes'));

/* Initialize the API server */
const port = process.env.API_PORT || 3001;
app.listen( port, () => console.log(`Server running on: ${port}`));

module.exports = app;
