import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js"
import { Video } from "../models/video.model.js";
import { Comment } from "../models/comment.model.js";
import { Subscription } from "../models/subscription.model.js";
import { Playlist } from "../models/playlist.model.js";
import { Tweet } from "../models/tweet.model.js";
import { VideoLike } from "../models/videoLike.model.js";
import { CommentLike } from "../models/CommentLike.model.js";
import { TweetLike } from "../models/TweetLike.model.js";
import { uploadOnCloudinary , deleteFromCloudinary} from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { symlink } from "fs";
import { subscribe } from "diagnostics_channel";
import mongoose from "mongoose";

const generateAccessAndRefreshToken = async (userId) => {
    try{
        const user = await User.findById(userId);
        const accessToken = user.generateAccessToken();
        const refreshToken = user.generateRefreshToken();

        user.refreshToken = refreshToken;
        await user.save({validateBeforeSave:false});

        return {accessToken,refreshToken};
    }catch(error){
        throw new ApiError(500,"Something went wrong while genrating Token");
    }
}

const getCloudinaryPublicIdFromUrl = (url) => {
    if(!url) return null;

    try {
        const pathParts = new URL(url).pathname.split("/").filter(Boolean);
        const uploadIndex = pathParts.indexOf("upload");

        if(uploadIndex === -1) return null;

        const publicIdParts = pathParts.slice(uploadIndex + 1);

        if(publicIdParts[0]?.match(/^v\d+$/)){
            publicIdParts.shift();
        }

        const fileName = publicIdParts.pop();
        const publicId = fileName?.split(".").slice(0,-1).join(".");

        if(publicId){
            publicIdParts.push(publicId);
        }

        return publicIdParts.join("/");
    } catch (error) {
        return url.split("/")?.slice(-1)?.[0]?.split(".")?.[0] || null;
    }
}

const registerUser = asyncHandler(async (req,res)=>{

    const {email,fullName,username,password} = req.body;
    
    if(!fullName||!username||!email||!password){
        throw new ApiError(400,"All fields are required");
    }
    
    const existedUser = await User.findOne({
        $or:[{email},{username}]
    });

    if(existedUser){
        throw new ApiError(409,"User Already Existed");
    }
    
    // get file paths from multer
    const avatarLocalPath = req.files?.avatar[0]?.path;
    const coverImageLocalPath = req.files?.coverImage?.length > 0 ? req.files?.coverImage[0]?.path :null;

    if(!avatarLocalPath){
        throw new ApiError(400,"Avatar file is required");
    }

    // upload on cloudinary
    const avatar = await uploadOnCloudinary(avatarLocalPath)
    const coverImage = await uploadOnCloudinary(coverImageLocalPath);

    if(!avatar){
        throw new ApiError(400,"Avatar file is required");
    }

    // create user entry in db
    const user = await User.create({
        fullName,
        avatar:avatar.url,
        coverImage:coverImage?.url || "",
        email,
        password,
        username:username.toLowerCase()
    })
    
    // remove password and refresh token from response
    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    );
    
    // check for user creation
    if(!createdUser){
        throw new ApiError(500,"Something went worng while register a user");
    }

    const {accessToken,refreshToken} = await generateAccessAndRefreshToken(user._id);

    const options = {
        httpOnly:true,
        secure:false,
    }

    console.log("User controller successfull");
    
    return res.status(201)
    .cookie("accessToken",accessToken,options)
    .cookie("refreshToken",refreshToken,options)
    .json(
        new ApiResponse(200,{
            loginUser:createdUser,
            accessToken,
            refreshToken,
        },"User register succesfully")
    )
});

const loginUser = asyncHandler(async (req,res)=>{
    // fetch email or username and password from req.body
    // check for in database;
    // redirect it to home page
    // genrate and give access token;
    // send cookies
    // refresh  the session after 60 min

    const {email,username,password} = req.body;

    if(!email && !username){
        throw new ApiError(400,"All fields are required");
    }

    if (!password) {
        throw new ApiError(400,"password is required")
    }

    const loginUser = await User.findOne({
        $or:[{email},{username}]
    });

    if(!loginUser){
        throw new ApiError(404,"User not found, please register");
    }

    const isPasswordValid = await loginUser.isPasswordCorrect(password);

    if(!isPasswordValid){
        throw new ApiError(401,"Wrong Password try again");
    }

    const {accessToken,refreshToken} = await generateAccessAndRefreshToken(loginUser._id);

    const loggedInUser = await User.findById(loginUser._id).select("-password -refreshToken")

    const options = {
        httpOnly:true,
        secure:false, // set to true in production
    }

    return res.status(200)
    .cookie("accessToken",accessToken,options)
    .cookie("refreshToken",refreshToken,options)
    .json(
        new ApiResponse(200,{
            loginUser:loggedInUser,accessToken,refreshToken,
        },"User Login Successfull")
    )

});

const logoutUser = asyncHandler(async (req,res)=>{

    User.findByIdAndUpdate(
        req.user._id,
        {
            $unset:{
                refreshToken:1
            }
        },
        {
            new:true
        }
    )
    
    const options = {
        httpOnly:true,
        secure:true
    }

    return res
    .status(200)
    .clearCookie("accessToken",options)
    .clearCookie("refreshToken",options)
    .json(new ApiResponse(200,{},"User logout Successfull"))
});

const refreshAccessToken = asyncHandler(async(req,res)=>{
    const incomingRefreshToken =  req.cookies.refreshToken || req.body.refreshToken

    if(!incomingRefreshToken){
        throw new ApiError(401,"unauthorised request");
    }

    try {
        const decodedToken = jwt.verify(
            incomingRefreshToken,process.env.REFRESH_TOKEN_SECRET
        )
    
        const user = await User.findById(decodedToken?._id);
    
        if(!user){
            throw new ApiError(401,"Invalid refresh Token"); 
        }
    
        if(incomingRefreshToken !== user.refreshToken){
            throw new ApiError(401,"Refresh Token is expired or used");
        }
    
        const options = {
            httpOnly:true,
            secure:false
        }
    
        const { accessToken,refreshToken } = await generateAccessAndRefreshToken(user._id);
    
        return res
        .status(200)
        .cookie("accessToken",accessToken,options)
        .cookie("refreshToken",refreshToken,options)
        .json(
            new ApiResponse(200,{accessToken,refreshToken},"Access token refreshed")
        )
    } catch (error) {
        throw new ApiError(401,error?.message || "Invalid Refresh Token")
    }
});

const changeCurrentPassword = asyncHandler(async(req,res)=>{
    const {oldPassword,newPassword} = req.body;

    const user = await User.findById(req.user?._id);
    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);

    if(!isPasswordCorrect){
        throw new ApiError(400,"Invalid old password");
    }

    user.password = newPassword;
    await user.save({validateBeforeSave:false})

    return res.status(200)
    .json(new ApiResponse(200,{},"Password change Successfully"));
});

const getCurrentUser = asyncHandler(async(req,res)=>{
    return res.status(200)
    .json(new ApiResponse(200,req.user,"Current User Fetch Successfully"))
});

const updateAccountDetails = asyncHandler(async(req,res)=>{
    // find user by id
    // then update through findbyIdandupdate

    const {fullName} = req.body;

    if(!fullName){ 
        throw new ApiError(400,"Full name is required");
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id
        ,{
            $set:{
                fullName:fullName,
            }
        }
        ,{new:true}).select("-password")

    return res
    .status(200)
    .json(new ApiResponse(200,user,"Account update Successfully"))
});

const updateAccountAvatar = asyncHandler(async(req,res)=>{
    const avatarLocalPath = req.file?.path

    if(!avatarLocalPath){
        throw new ApiError(400,"Avatar file is missing")
    }
    // check this full logic again of delete from cloudnary

    const olduser = await User.findById(req.user?._id);
    const oldAvatarPublicId = olduser.avatar?.split("/")?.slice(-1)?.[0]?.split(".")?.[0];

    console.log(oldAvatarPublicId);
    

    await deleteFromCloudinary(oldAvatarPublicId);

    const avatar = await uploadOnCloudinary(avatarLocalPath);

    if(!avatar.url){
        throw new ApiError(400,"Error while uploading on avatar");
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                avatar:avatar.url
            }
        },{
            new :true
        }
    ).select("-password -refreshToken")

    return res.status(200)
    .json(new ApiResponse(200,user,"Avatar update Succesfully"))

});

const updateAccountCoverImage = asyncHandler(async(req,res)=>{
    const coverImageLocalPath = req.file?.path

    if(!coverImageLocalPath){
        throw new ApiError(400,"Cover Image is missing")
    }

    const coverImage = await uploadOnCloudinary(coverImageLocalPath);

    const user = await User.findByIdAndUpdate(
    req.user?._id,{
    $set:{
        coverImage : coverImage.url
    }
   },{
    new:true
   }).select("-password")

   return res.status(200).
   json(new ApiResponse(200,user,"Cover Image updated Successfully"));

});

const getUserChannelProfile = asyncHandler(async(req,res)=>{
    const {username} = req.params;

    if (!username.trim()) {
        throw new ApiError(400,"username is missing")
    }

    const matchStage = mongoose.Types.ObjectId.isValid(username)
        ? { _id: new mongoose.Types.ObjectId(username) }
        : { username: username?.toLowerCase() };

    // pipeline to fetch channel details along with subscriber count, channels subscribed to count and isSubscribed field
    const channel = await User.aggregate([
            {
                $match: matchStage
            },{
                $lookup:{
                    from:"subscriptions",
                    localField:"_id",
                    foreignField:"channel",
                    as:"subscribers"
                }
            },{
                $lookup:{
                    from:"subscriptions",
                    localField:"_id",
                    foreignField:"subscriber",
                    as:"subscribedTo"
                }
            },{
                $addFields:{
                    subscribersCount:{
                        $size:"$subscribers"
                    },
                    channelsSubscribedToCount:{
                        $size:"$subscribedTo"
                    },
                    isSubscribed:{
                        $cond:{
                            if:{$in:[req.user?._id,"$subscribers.subscriber"]},
                            then:true,
                            else:false
                        }
                    }
                }
            },{
                $project:{
                    fullName:1,
                    email:1,
                    username:1,
                    avatar:1,
                    subscribersCount:1,
                    channelsSubscribedToCount:1,
                    isSubscribed:1,
                    coverImage:1
                }
            }
        ])

        if(!channel?.length){
            throw new ApiError(404,"Channel not found");
        }

        return res
        .status(200)
        .json(
            new ApiResponse(200,channel[0],"User channel fetched successfully")
        )
});

const getWatchHistory = asyncHandler(async(req,res)=>{
    const user = await User.aggregate([
        {
            $match:{
                _id : new mongoose.Types.ObjectId(req.user._id)
            }
        },{
            $addFields:{
                normalizedWatchHistory:{
                    $map:{
                        input:{$ifNull:["$watchHistory",[]]},
                        as:"historyItem",
                        in:{
                            video:{
                                $ifNull:["$$historyItem.video","$$historyItem"]
                            },
                            watchedAt:{
                                $ifNull:["$$historyItem.watchedAt","$createdAt"]
                            }
                        }
                    }
                }
            }
        },{
            $addFields:{
                historyVideoIds:"$normalizedWatchHistory.video"
            }
        },{
            $lookup:{
                from:"videos",
                localField:"historyVideoIds",
                foreignField:"_id",
                as:"historyVideos",
                pipeline:[
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
                                        avatar:1 
                                    }
                                }
                            ]
                        }
                    },{
                        $addFields:{
                            owner:{
                                $first:"$owner"
                            }
                        }
                    },{
                        $project:{
                            title:1,
                            thumbnail:1,
                            duration:1,
                            views:1,
                            createdAt:1,
                            updatedAt:1,
                            owner:1,
                        }
                    }
                ]
            }
        },{
            $addFields:{
                watchHistory:{
                    $map:{
                        input:{
                            $sortArray:{
                                input:"$normalizedWatchHistory",
                                sortBy:{watchedAt:-1}
                            }
                        },
                        as:"historyItem",
                        in:{
                            $mergeObjects:[
                                {
                                    $first:{
                                        $filter:{
                                            input:"$historyVideos",
                                            as:"historyVideo",
                                            cond:{$eq:["$$historyVideo._id","$$historyItem.video"]}
                                        }
                                    }
                                },
                                {
                                    watchedAt:"$$historyItem.watchedAt"
                                }
                            ]
                        }
                    }
                }
            }
        },{
            $project:{
                fullName:1,
                username:1,
                avatar:1,
                watchHistory:1
            }
        }
    ])

    return res
    .status(200)
    .json(
        new ApiResponse(200,user[0],"User watch history fetched successfully")
    )
});

const removeVideoFromWatchHistory = asyncHandler(async(req,res)=>{
    const { videoId } = req.params;

    if(!mongoose.Types.ObjectId.isValid(videoId)){
        throw new ApiError(400,"Invalid video id");
    }

    const videoObjectId = new mongoose.Types.ObjectId(videoId);

    await Promise.all([
        User.updateOne(
            {_id:req.user._id},
            {$pull:{watchHistory:{$in:[videoObjectId,videoId]}}}
        ),
        User.updateOne(
            {_id:req.user._id},
            {$pull:{watchHistory:{video:{$in:[videoObjectId,videoId]}}}}
        )
    ]);

    return res
    .status(200)
    .json(new ApiResponse(200,null,"Video removed from watch history"));
});

const clearWatchHistory = asyncHandler(async(req,res)=>{
    await User.findByIdAndUpdate(req.user._id,{
        $set:{
            watchHistory:[]
        }
    });

    return res
    .status(200)
    .json(new ApiResponse(200,null,"Watch history cleared successfully"));
});

const deleteUserAccount = asyncHandler(async(req,res)=>{
    const userId = req.user?._id;

    const user = await User.findById(userId);

    if(!user){
        throw new ApiError(404,"User not found");
    }

    const videos = await Video.find({owner:userId})
    .select("_id videoFilePublicId thumbnailPublicId")
    .lean();

    const videoIds = videos.map((video)=>video._id);

    const [commentIds,tweetIds,subscribers,subscribedChannels] = await Promise.all([
        Comment.find({
            $or:[
                {owner:userId},
                {video:{$in:videoIds}}
            ]
        }).distinct("_id"),

        Tweet.find({owner:userId}).distinct("_id"),

        Subscription.find({channel:userId})
        .select("subscriber")
        .lean(),

        Subscription.find({subscriber:userId})
        .select("channel")
        .lean()
    ]);

    const subscriberIds = subscribers.map((subscription)=>subscription.subscriber);
    const subscribedChannelIds = subscribedChannels.map((subscription)=>subscription.channel);

    await Promise.all([
        VideoLike.deleteMany({
            $or:[
                {likedBy:userId},
                {video:{$in:videoIds}}
            ]
        }),

        CommentLike.deleteMany({
            $or:[
                {likedBy:userId},
                {comment:{$in:commentIds}}
            ]
        }),

        TweetLike.deleteMany({
            $or:[
                {likedBy:userId},
                {tweet:{$in:tweetIds}}
            ]
        }),

        Comment.deleteMany({
            $or:[
                {owner:userId},
                {video:{$in:videoIds}}
            ]
        }),

        Tweet.deleteMany({owner:userId}),

        Playlist.deleteMany({owner:userId}),

        Playlist.updateMany(
            {videos:{$in:videoIds}},
            {$pull:{videos:{$in:videoIds}}}
        ),

        User.collection.updateMany(
            {watchHistory:{$in:videoIds}},
            {$pull:{watchHistory:{$in:videoIds}}}
        ),

        User.updateMany(
            {"watchHistory.video":{$in:videoIds}},
            {$pull:{watchHistory:{video:{$in:videoIds}}}}
        ),

        User.updateMany(
            {_id:{$in:subscribedChannelIds}},
            {$inc:{subscriberCount:-1}}
        ),

        User.updateMany(
            {_id:{$in:subscriberIds}},
            {$inc:{subscribedToCount:-1}}
        ),

        Subscription.deleteMany({
            $or:[
                {subscriber:userId},
                {channel:userId}
            ]
        }),

        Video.deleteMany({owner:userId}),

        User.findByIdAndDelete(userId)
    ]);

    await Promise.all([
        ...videos.flatMap((video)=>[
            video.videoFilePublicId && deleteFromCloudinary(video.videoFilePublicId),
            video.thumbnailPublicId && deleteFromCloudinary(video.thumbnailPublicId)
        ]),
        deleteFromCloudinary(getCloudinaryPublicIdFromUrl(user.avatar)),
        deleteFromCloudinary(getCloudinaryPublicIdFromUrl(user.coverImage))
    ]);

    const options = {
        httpOnly:true,
        secure:true
    }

    return res
    .status(200)
    .clearCookie("accessToken",options)
    .clearCookie("refreshToken",options)
    .json(new ApiResponse(200,null,"User account deleted successfully"));

});

export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    updateAccountDetails,
    updateAccountAvatar,
    updateAccountCoverImage,
    getUserChannelProfile,
    getWatchHistory,
    removeVideoFromWatchHistory,
    clearWatchHistory,
    deleteUserAccount
}
