import mongoose, { isValidObjectId } from "mongoose"
import {Tweet} from "../models/tweet.model.js"
import {User} from "../models/user.model.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"
import { TweetLike } from "../models/TweetLike.model.js"

const getAllTweets = asyncHandler(async (req, res) => {
    const tweets = await Tweet.find({})
        .populate("owner", "username fullName avatar coverImage")
        .sort({ createdAt: -1 })
        .select("-__v");

    const tweetsWithStats = await Promise.all(
        tweets.map(async (tweet) => {
            const [likeCount, isLiked] = await Promise.all([
                TweetLike.countDocuments({ tweet: tweet._id }),
                TweetLike.exists({ tweet: tweet._id, likedBy: req.user._id }),
            ]);

            return {
                ...tweet.toObject(),
                likeCount,
                isLiked: Boolean(isLiked),
                isDisliked: false,
            };
        })
    );

    return res
    .status(200)
    .json(new ApiResponse(200,tweetsWithStats,"Tweets fetched successfully"));
})

const getUserTweets = asyncHandler(async (req, res) => {
    const {userId} = req.params;

    if(!isValidObjectId(userId)){
        throw new ApiError(400,"Invalid user ID");
    }

    const tweets = await Tweet.find({owner:userId})
        .populate("owner", "username fullName avatar coverImage")
        .sort({ createdAt: -1 })
        .select("-__v");

    const tweetsWithStats = await Promise.all(
        tweets.map(async (tweet) => {
            const [likeCount, isLiked] = await Promise.all([
                TweetLike.countDocuments({ tweet: tweet._id }),
                TweetLike.exists({ tweet: tweet._id, likedBy: req.user._id }),
            ]);

            return {
                ...tweet.toObject(),
                likeCount,
                isLiked: Boolean(isLiked),
                isDisliked: false,
            };
        })
    );

    return res
    .status(200)
    .json(new ApiResponse(200,tweetsWithStats,"User tweets fetched successfully"));
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

    // delete all the likes of tweet
    await TweetLike.deleteMany({
        tweet:tweetId,
    })

    return res
    .status(200)
    .json(new ApiResponse(200,null,"Tweet deleted Successfully"));
})

export {
    createTweet,
    getAllTweets,
    getUserTweets,
    updateTweet,
    deleteTweet
}
