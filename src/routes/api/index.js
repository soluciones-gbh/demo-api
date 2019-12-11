const express = require('express');
const router = express.Router();

/* GET home page. */
router.get('/', function(req, res, next) {
  res.setHeader('Content-Type', 'application/json');
  res.json({
    "appName": "Demo WebApp",
    "message": "using NodeJs and Express!"
  });
});

module.exports = router;