import mongoose, {isValidObjectId} from "mongoose"
import {Playlist} from "../models/playlist.model.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"
import { Video } from "../models/video.model.js"

const MAX_PLAYLIST_NAME_LENGTH = 150;
const MAX_PLAYLIST_DESCRIPTION_LENGTH = 5000;

const getUserPlaylists = asyncHandler(async (req, res) => {
    const {userId} = req.params
    //TODO: get user playlists
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    if(!mongoose.Types.ObjectId.isValid(userId)){
        throw new ApiError(400,"Invalid User Id");
    }

    const playlists = await Playlist.find({owner:userId}).select("-__v")
    .sort({createdAt:-1})
    .skip(skip)
    .limit(limit)
    .populate("owner","fullName username avatar coverImage");

    return res
    .status(200)
    .json(new ApiResponse(200,playlists,"User playlists fetch Successfully"));
});

const getPlaylistById = asyncHandler(async (req, res) => {
    const {playlistId} = req.params
    //TODO: get playlist by id
    if(!mongoose.Types.ObjectId.isValid(playlistId)){   
        throw new ApiError(400,"Invalid Playlist Id");
    }

    // const playlist = await Playlist.findById({_id:playlistId}).populate("name description owner")

    const playlist = await Playlist.aggregate([
        {
            $match:{
                _id : new mongoose.Types.ObjectId(playlistId),
                owner : new mongoose.Types.ObjectId(req.user._id)
            }
        },
        {
            $lookup:{
                from:"users",
                localField:"owner",
                foreignField:"_id",
                as:"owner",
                pipeline:[
                    {
                        $project:{
                            fullName:1,
                            username:1,
                            avatar:1,
                            coverImage:1,
                        }
                    }
                ]
            }
        },
        {
            $addFields:{
                owner:{
                    $first:"$owner"
                }
            }
        },
        {
            $project:{
                name:1,
                description:1,
                owner:1,
                videoCount:{
                    $size: {$ifNull: ["$videos", []]}
                }
            }
        }
    ])

    if(!playlist.length){
        throw new ApiError(404,"Playlist not found or unauthorised");
    }

    return res
    .status(200)
    .json(new ApiResponse(200,playlist[0],"User playlist fetch Successfully"));

});

const getPlaylistVideosById = asyncHandler(async (req, res) => {
    const {playlistId} = req.params
    //TODO: get playlist by id

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    if(!mongoose.Types.ObjectId.isValid(playlistId)){   
        throw new ApiError(400,"Invalid Playlist Id");
    }

    const videos = await Playlist.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(playlistId),
                owner: new mongoose.Types.ObjectId(req.user._id)
            }
        },
        {
            $unwind: "$videos",
        },
        {
            $lookup: {
                from: "videos",
                localField: "videos",
                foreignField: "_id",
                as: "video"
            }
        },
        {
            $unwind:"$video",
        },
        {
            $skip:skip,
        },
        {
            $limit:limit,
        },
        {
            $lookup: {
                from: "users",
                localField: "video.owner",
                foreignField: "_id",
                as: "owner"
            }
        },
        {
            $addFields: {
                "video.owner": { $first: "$owner" }
            }
        },
        {
            $project: {
                _id: 0,
                video: {
                    _id: "$video._id",
                    title: "$video.title",
                    thumbnail: "$video.thumbnail",
                    duration: "$video.duration",
                    views: "$video.views",
                    createdAt: "$video.createdAt",
                    uploadedAt: "$video.uploadedAt",
                    owner: {
                        username: "$video.owner.username",
                        fullName: "$video.owner.fullName",
                        avatar: "$video.owner.avatar",
                        coverImage: "$video.owner.coverImage"
                    }
                }
            }
        }
    ]);

    if(!videos.length){
        throw new ApiError(404,"Playlist not found or empty");
    }

    return res
    .status(200)
    .json(new ApiResponse(200,videos,"Playlist Videos fetched successfully"));
});

const createPlaylist = asyncHandler(async (req, res) => {
    const {name, description} = req.body
    //TODO: create playlist

    if(!name || !name.trim()){
        throw new ApiError(400,"Name is required");
    }

    if(name.trim().length > MAX_PLAYLIST_NAME_LENGTH){
        throw new ApiError(400,`Name should not exceed ${MAX_PLAYLIST_NAME_LENGTH} characters`);
    }

    if(!description || !description.trim()){
        throw new ApiError(400,"Description is required");
    }

    if(description.trim().length > MAX_PLAYLIST_DESCRIPTION_LENGTH){
        throw new ApiError(400,`Description Should not exceed ${MAX_PLAYLIST_DESCRIPTION_LENGTH} characters`);
    }

    const existingPlaylist = await Playlist.findOne({
        name:name.trim(),
        owner:req.user._id
    });

    if(existingPlaylist){
        throw new ApiError(400,"Playlist with the same name already exists");
    }

    const playlist = await Playlist.create({
        name:name.trim(),
        description:description.trim(),
        videos:[],
        owner:req.user._id
    });

    return res
    .status(201)
    .json(new ApiResponse(201,playlist,"Playlist added successfully"));
});

const addVideoToPlaylist = asyncHandler(async (req, res) => {
    const {playlistId, videoId} = req.params
    if(!mongoose.Types.ObjectId.isValid(videoId)){
        throw new ApiError(400,"Invalid Video Id");
    }

    if(!mongoose.Types.ObjectId.isValid(playlistId)){
        throw new ApiError(400,"Inalid Playlist Id");
    }

    const video = await Video.findById(videoId);
    if(!video){
        throw new ApiError(400,"Video not found");
    }

    const addVideo = await Playlist.findByIdAndUpdate(
        {_id:playlistId,owner:req.user._id},
        {$addToSet:{videos:videoId}},
        {new:true}
    ).select("-__v");

    return res
    .status(201)
    .json(new ApiResponse(201,addVideo,"Video Added to Playlist Successfully"));

});

const removeVideoFromPlaylist = asyncHandler(async (req, res) => {
    const {playlistId, videoId} = req.params;
    // TODO: remove video from playlist
    if(!mongoose.Types.ObjectId.isValid(videoId)){
        throw new ApiError(400,"Invalid Video Id");
    }

    if(!mongoose.Types.ObjectId.isValid(playlistId)){
        throw new ApiError(400,"Inalid Playlist Id");
    }

    const video = await Video.findById(videoId);
    if(!video){
        throw new ApiError(400,"Video not found");
    }

    const removeVideo = await Playlist.findByIdAndUpdate(
        {_id:playlistId,owner:req.user._id},
        {$pull:{videos:videoId}},
        {new:true}
    ).select("-__v");

    res
    .status(200)
    .json(new ApiResponse(200,removeVideo,"Video removed from playlist successfully"));

});

const deletePlaylist = asyncHandler(async (req, res) => {
    const {playlistId} = req.params
    // TODO: delete playlist

    if(!mongoose.Types.ObjectId.isValid(playlistId)){
        throw new ApiError(400,"Invalid Playlist Id");
    }

    const playlist = await Playlist.findOneAndDelete({
        _id:playlistId,
        owner:req.user._id
    });

    if(!playlist){
        throw new ApiError(404,"Playlist not found or unauthorised");
    }   

    return res
    .status(200)
    .json(new ApiResponse(200,playlist,"Playlist deleted successfully"));
});

const updatePlaylist = asyncHandler(async (req, res) => {
    const {playlistId} = req.params
    const {name, description} = req.body
    //TODO: update playlist

    if(!name || !name.trim()){
        throw new ApiError(400,"Name is required");
    }

    if(name.trim().length > MAX_PLAYLIST_NAME_LENGTH){
        throw new ApiError(400,`Name should not exceed ${MAX_PLAYLIST_NAME_LENGTH} characters`);
    }   

    if(!description || !description.trim()){
        throw new ApiError(400,"Description is required");
    }

    if(description.trim().length > MAX_PLAYLIST_DESCRIPTION_LENGTH){
        throw new ApiError(400,`Description Should not exceed ${MAX_PLAYLIST_DESCRIPTION_LENGTH} characters`);
    }   

    if(!mongoose.Types.ObjectId.isValid(playlistId)){
        throw new ApiError(400,"Invalid Playlist Id");
    }

    const existingPlaylist = await Playlist.findOne({
        name:name.trim(),
        owner:req.user._id,
        _id:{$ne:playlistId}
    });

    if(existingPlaylist){
        throw new ApiError(400,"Playlist with the same name already exists");
    }

    const playlist = await Playlist.findOneAndUpdate(
        {_id:playlistId,owner:req.user._id},
        {name:name.trim(),description:description.trim()},
        {new:true}
    ).select("-__v");

    if(!playlist){
        throw new ApiError(404,"Playlist not found or unauthorised");
    }

    return res
    .status(200)
    .json(new ApiResponse(200,playlist,"Playlist updated successfully"));
});

export {
    createPlaylist,
    getUserPlaylists,
    getPlaylistById,
    getPlaylistVideosById,
    addVideoToPlaylist,
    removeVideoFromPlaylist,
    deletePlaylist,
    updatePlaylist
} 
