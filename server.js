//import dependencies
const express = require('express');

// create an Express.js instance
const app = express();
const path = require("path");
const fs = require("fs");
let port = process.env.PORT ?? 4000

// config Express.js
app.use(express.json())
// log all requests
app.use(function (request, response,next) {
    console.log("In comes a "+request.method+" to "+request.url);
    next();
})
// Cross-Origin Resource Sharing (CORS) Allows the server to respond to ANY request indicated by '*'
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Allow-Methods", "GET,HEAD,OPTIONS,POST,PUT");
    res.setHeader("Access-Control-Allow-Headers", "Access-Control-Allow-Headers, Origin,Accept, X-Requested-With, Content-Type, Access-Control-Request-Method, Access-Control-Request-Headers")

    next();
})

//mount the public path & let all public files have prefix of public
app.use('/public', express.static('public'))

//serve files if request is targeted at public directory. Throw error if file not found
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
let db;

//initialise collections for reuse
let lessonsCollection
let ordersCollection

//connect to mongodb
MongoClient.connect('mongodb+srv://freddy:7f7jA6dUicg5R51c@mycluster.duiazwk.mongodb.net/?retryWrites=true&w=majority', (err, client) => {
    db = client.db('coursework')
    lessonsCollection = db.collection('lessons');
    ordersCollection = db.collection('orders');
    console.log("connected to mongodb");
});


app.get('/', (req, res, next) => {
    res.send('Nothing here check other links.')
})

app.get('/lessons', (req, res, next) => {
    lessonsCollection.find({}).toArray((e, results) => {
            if (e) return next(e)
            res.send(results)
        }
    )
})
const ObjectID = require('mongodb').ObjectID;
app.put('/lesson', (req, res, next) => {
    let lessonId = req.body.lessonId;
    let reduceByQuantity = parseInt(req.body.reduceByQuantity);
    if (lessonId != null && reduceByQuantity != null) {
        lessonsCollection.updateMany(
            {
                _id: ObjectID(lessonId)
            },
            {
                $inc: {
                    spaces: -reduceByQuantity
                }
            },
            {
                safe: true,
            },
            (e, result) => {
                if (e) return next(e)
                res.send((result.result.n > 0) ? {msg: 'Successful'} : {msg: 'An error occurred.'})
            }
        )
    }
    else{
        res.status(400);
        res.send({error: "Kindly specify lessonId && quantity to reduce by."});
    }
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
    else{
        res.status(400);
        res.send({error: "Kindly specify what to search with the query param 'q' "});
    }


})

app.get('/order', (req, res, next) => {
    ordersCollection.find({}).toArray((e, results) => {
            if (e) return next(e)
            res.send(results)
        }
    )
})

app.post('/order', (req, res, next) => {
    //ensure required parameters are passed before saving order
    if (req.body.name != null && req.body.phone != null){
        ordersCollection.insert(req.body, (e, results) => {
                if (e) return next(e)
                res.send(results.ops)
            }
        )
    }
    else{
        res.status(400);
        res.send("Kindly enter all required fields.");
    }

})

app.post('/lessons', (req, res, next) => {
    lessonsCollection.insert(req.body, (e, results) => {
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
