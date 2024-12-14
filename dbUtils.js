const path = require("path"); /* Module for path */
require("dotenv").config({ path: path.resolve(__dirname, '.env') }) 
const { MongoClient, ServerApiVersion } = require('mongodb');
/* read values from .env file */
const userName = process.env.MONGO_DB_USERNAME;
const dbPassword = process.env.MONGO_DB_PASSWORD;
const dbName = process.env.MONGO_DB_NAME;
const colName = process.env.MONGO_COLLECTION;
const colUsers = process.env.MONGO_USER_COLLECTION;
const colOrders = process.env.MONGO_ORDER_COLLECTION

const uri = 'mongodb+srv://' + userName + ':' + dbPassword + '@' +
    'cluster0.cjpfb.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

const client = new MongoClient(uri, { serverApi: ServerApiVersion.v1 });

const createUser = async (user) => {
    try {
        await client.connect();
        let result = await client.db(dbName)
            .collection(colUsers)
            .insertOne(user);
    } catch (e) {
        console.error(e);
    } finally {
        await client.close();
    }
}

const findByUserName = async (filter) => {
    try {
        await client.connect();
        let result = await client.db(dbName)
            .collection(colUsers)
            .findOne(filter);

        return result;
    } catch (e) {
        console.error(e);
    } finally {
        await client.close();
    }
}

const createOrder = async (order) => {
    try {
        await client.connect();
        let result = await client.db(dbName)
            .collection(colOrders)
            .insertOne(order);
        return result;
    } catch (e) {
        console.error(e);
    } finally {
        await client.close();
    }
}


module.exports = {
    createUser,
    findByUserName,
    createOrder
}
