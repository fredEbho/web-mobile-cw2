//import dependencies
const express = require('express');

// create an Express.js instance
const app = express();
let logger = require('morgan');
const path = require("path");
const fs = require("fs");
const {query} = require("express");
let port = process.env.PORT ?? 4000

// config Express.js
// Cross-Origin Resource Sharing (CORS) Allows the server to respond to ANY request indicated by '*'
app.use(express.json())
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Allow-Methods", "GET,HEAD,OPTIONS,POST,PUT");
    res.setHeader("Access-Control-Allow-Headers", "Access-Control-Allow-Headers, Origin,Accept, X-Requested-With, Content-Type, Access-Control-Request-Method, Access-Control-Request-Headers")

    next();
})

// log requests
app.use(logger('server'));

//mount the public path & let all public files have prefix of public
app.use('/public', express.static('public'))

app.use(function (request, response, next) {
    if (request.url.includes('public')){
        let filePath = path.join(__dirname, "public", request.url)
        fs.stat(filePath, function (err, fileInfo) {
            if (err) {
                response.status(404);
                response.send("File not found! - " + err);
            } else {
                response.sendFile(filePath);
            }

        })
    }
    else {
        next();
    }
})

// initialise mongo client
const MongoClient = require('mongodb').MongoClient;

//connect to mongodb
let db;
MongoClient.connect('mongodb+srv://freddy:7f7jA6dUicg5R51c@mycluster.duiazwk.mongodb.net/?retryWrites=true&w=majority', (err, client) => {
    db = client.db('coursework')
})

//initialise collections for reusability
let lessonsCollection = db.collection('lessons');
let ordersCollection = db.collection('orders');

app.get('/', (req, res, next) => {
    res.send('Nothing here check other links.')
})

app.get('/lessons', (req, res, next) => {
    let searchQuery = req.query.search;
    let collectionQuery;
    if (searchQuery != null && searchQuery.length > 0) {
        collectionQuery = lessonsCollection.aggregate(createSearchPipeline(searchQuery));
    }
    else{
        collectionQuery = lessonsCollection.find({});
    }

    collectionQuery.toArray((e, results) => {
            if (e) return next(e)
            res.send(results)
        }
    )
})

app.put('/lesson/:lessonId', (req, res, next) => {
    lessonsCollection.update(
        {
            id: req.params.lessonId
        },
        {
            $inc: {
                spaces: -1
            }
        },
        {
            // tells mongodb to wait before callback function to process only 1 item
            safe: true, multi: false
        },
        (e, result) => {
            if (e) return next(e)
            res.send((result.result.n === 1) ? {msg: 'success'} : {msg: 'error'})
        }
    )
})

app.get('/search', (req, res, next) => {
    let searchQuery = req.query.q;
    if (searchQuery != null && searchQuery.length > 0) {
        lessonsCollection.aggregate(createSearchPipeline(searchQuery)).toArray((e, results) => {
                if (e) return next(e)
                res.send(results)
            }
        )
    }

    res.status(400);
    res.send("Please specify what to search with the query param 'q' ");


})

app.get('/order', (req, res, next) => {
    ordersCollection.find({}).toArray((e, results) => {
            if (e) return next(e)
            res.send(results)
        }
    )
})

app.post('/order', (req, res, next) => {
    ordersCollection.insert(req.body, (e, results) => {
            if (e) return next(e)
            res.send(results.ops)
        }
    )
})


app.listen(port, () => {
    console.log('express is running on port ' + port)
})

function createSearchPipeline(searchQuery) {
    return [
        {
            $search: {
                index: 'user_search',
                compound: {
                    should: [
                        {
                            autocomplete: {
                                query: searchQuery,
                                path: 'topic',
                            },
                        },
                        {
                            autocomplete: {
                                query: searchQuery,
                                path: 'location',
                            },
                        },
                    ],
                },
            }
        }
    ]

}
