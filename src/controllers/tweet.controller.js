import mongoose, { isValidObjectId } from "mongoose"
import {Tweet} from "../models/tweet.model.js"
import {User} from "../models/user.model.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"

const getUserTweets = asyncHandler(async (req, res) => {
    // TODO: get user tweets
})

const createTweet = asyncHandler(async (req, res) => {
    //TODO: create tweet
    const {content} = req.body;

    if(!content || !content.trim()){
        throw new ApiError(400,"Content is not given");
    }

    if(content.trim().length > 1000){
        throw new ApiError(400,"Tweet should not exceed 1000 characters");
    }

    const tweet = await Tweet.create({
        content:content.trim(),
        owner:req.user._id
    })

    return res
    .status(201)
    .json(new ApiResponse(201,tweet,"Tweet added Successfully"));
})

const updateTweet = asyncHandler(async (req, res) => {
    //TODO: update tweet
    const {tweetId} = req.params;
    const {content} = req.body;

    if(!mongoose.Types.ObjectId.isValid(tweetId)){
        throw new ApiError(400,"Invalid Tweet Id");
    }

    if(!content || !content.trim()){
        throw new ApiError(400,"Content is not given");
    }

    if(content.trim().length > 1000){
        throw new ApiError(400,"Tweet should not exceed 1000 character");
    }

    const updatedTweet = await Tweet.findOneAndUpdate(
            {_id:tweetId,owner:req.user._id},
            {content:content.trim()},
            {new:true}
        ).select("-__v");
    
        if(!updatedTweet){
            throw new ApiError(404,"Content not found or unauthorised");
        }

        return res
        .status(200)
        .json(new ApiResponse(200,updatedTweet,"Tweet updated Succesfully"));
})

const deleteTweet = asyncHandler(async (req, res) => {
    //TODO: delete tweet

    const {tweetId} = req.params;

    if(!mongoose.Types.ObjectId.isValid(tweetId)){
        throw new ApiError(400,"Invalid Tweet Id");
    }

    const tweet = await Tweet.findOneAndDelete({
        _id:tweetId,
        owner:req.user._id
    });

    if(!tweet){
        throw new ApiError(404,"Tweet not found or unauthorized");
    }

    return res
    .status(200)
    .json(new ApiResponse(200,null,"Tweet deleted Successfully"));
})

export {
    createTweet,
    getUserTweets,
    updateTweet,
    deleteTweet
}