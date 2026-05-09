import mongoose, {isValidObjectId} from "mongoose"
import {ApiError} from "../utils/ApiError.js"
import { VideoLike } from "../models/videoLike.model.js"
import { Video } from "../models/video.model.js"
import { Tweet } from "../models/tweet.model.js"
import { Comment } from "../models/comment.model.js"
import { CommentLike } from "../models/CommentLike.model.js"
import { TweetLike } from "../models/TweetLike.model.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"

const toggleVideoLike = asyncHandler(async (req, res) => {
    const {videoId} = req.params
    //TODO: toggle like on video
    if(!mongoose.Types.ObjectId.isValid(videoId)){
        throw new ApiError(400, "Invalid video ID")
    }

    const video = await Video.findById(videoId);

    if(!video){
        throw new ApiError(404, "Video not found");
    }

    try{
        // like

        await VideoLike.create({
            video:videoId,
            likedBy:req.user._id,
        })

        const likeCount = await VideoLike.countDocuments({ video: videoId });

        return res
        .status(200)
        .json(new ApiResponse(200,{isLiked:true, likeCount},"Video Liked"));
    }catch(error){
        // Dislike

        if(error.code === 11000){
            await VideoLike.deleteOne({
                video:videoId,
                likedBy:req.user._id,
            })

        const likeCount = await VideoLike.countDocuments({ video: videoId });

        return res
        .status(200)
        .json(new ApiResponse(200,{isLiked:false, likeCount},"Video unliked"));
        }

        throw error;
    }

})

const toggleCommentLike = asyncHandler(async (req, res) => {
    const {commentId} = req.params
    //TODO: toggle like on comment

    if(!mongoose.Types.ObjectId.isValid(commentId)){
        throw new ApiError(400,"Invalid Comment Id");
    };

    const comment = await Comment.findById(commentId);

    if(!comment){
        throw new ApiError(400,"Comment not found");
    }

    try{
        //like
        await CommentLike.create({
            comment:commentId,
            likedBy:req.user._id
        })

        return res
        .status(200)
        .json(new ApiResponse(200,{isLiked:true},"Comment liked"));
    }catch(error){
        // dislike
        if(error.code === 11000){
            await CommentLike.deleteOne({
                comment:commentId,
                likedBy:req.user._id
            });

            return res
            .status(200)
            .json(new ApiResponse(200,{isLiked:false},"Comment unlike"));
        }

        throw error;
    }

})

const toggleTweetLike = asyncHandler(async (req, res) => {
    const {tweetId} = req.params
    //TODO: toggle like on tweet
    if(!mongoose.Types.ObjectId.isValid(tweetId)){
        throw new ApiError(400,"Invalid Id");
    }

    const tweet = await Tweet.findById(tweetId);

    if(!tweet){
        throw new ApiError(400,"Tweet not found");
    }

    try{
        //like

        await TweetLike.create({
            tweet:tweetId,
            likedBy:req.user._id
        })

        const likeCount = await TweetLike.countDocuments({ tweet: tweetId });

        return res
        .status(200)
        .json(new ApiResponse(200,{isLiked:true, likeCount},"Tweet Liked"))
    }catch(error){
        // dislike
        if(error.code === 11000){
            await TweetLike.deleteOne({
                tweet:tweetId,
                likedBy:req.user._id
            });

            const likeCount = await TweetLike.countDocuments({ tweet: tweetId });

            return res
            .status(200)
            .json(new ApiResponse(200,{isLiked:false, likeCount},"Tweet Unliked"));
        }

        throw error;
    }
})

const getLikedVideos = asyncHandler(async (req, res) => {
    //TODO: get all liked videos
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    const [likedVideos, total] = await Promise.all([
        VideoLike.find({ likedBy: req.user._id })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .populate({
                path: "video",
                match: { isPublished: true },
                select: "title description thumbnail duration views owner createdAt updatedAt",
                populate: {
                    path: "owner",
                    select: "username fullName avatar"
                }
            })
            .select("video createdAt"),
        VideoLike.countDocuments({ likedBy: req.user._id })
    ]);

    const videos = likedVideos
        .filter((likedVideo) => likedVideo.video)
        .map((likedVideo) => ({
            ...likedVideo.video.toObject(),
            likedAt: likedVideo.createdAt
        }));

    return res
    .status(200)
    .json(new ApiResponse(200, {
        videos,
        total,
        page,
        limit
    }, "Liked videos fetched successfully"));
})

export {
    toggleCommentLike,
    toggleTweetLike,
    toggleVideoLike,
    getLikedVideos
}
