// require ('dotenv').config({path:'./env'});
import dotenv from 'dotenv'
dotenv.config();
import express from "express"
import connectDB from "./db/index.js"; 
import mongoose from 'mongoose'; 
import { DB_NAME } from './constants.js';
import { app } from './app.js';


connectDB()
.then(()=>{
    app.on("error",(err)=>{
        console.log("Error in server setup",err);
        throw error
    });
    app.listen(process.env.PORT || 8000),()=>{
        console.log(`Server is running at port: ${process.env.PORT}`);
    }
})
.catch((err)=>{
    console.log("Mongo Db connection failed!!!",err);
    
}) 
