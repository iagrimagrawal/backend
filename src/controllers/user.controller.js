import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js"
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { symlink } from "fs";

const generateAccessAndRefreshToken = async (userId) => {
    try{
        const user = await User.findById(userId);
        const accessToken = user.generateAccessToken();
        const refreshToken = user.generateRefreshToken();

        user.refreshToken = refreshToken;
        await user.save({validateBeforeSave:false});

        return {accessToken,refreshToken};
    }catch(error){
        throw new ApiError(500,"Something went wrong while genrating Token");1
    }
}

const registerUser = asyncHandler(async (req,res)=>{

    // get user detail from frontend
    // validation - not empty
    // check if user already exist:username, email
    // check for images,check for avatar
    // upload them to cloudinary , avatar
    // create user object - create entry in db
    // remove password and refresh token field from response
    // check for user creation 
    // return response 

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

    console.log("User controller successfull");
    
    return res.status(201).json(
        new ApiResponse(200,createdUser,"User register succesfully")
    )
})

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
        secure:true
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
            $set:{
                refreshToken:undefined
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
})

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
            secure:true
        }
    
        const {accessToken,newrefreshToken} = await generateAccessAndRefreshToken(user._id)
    
        return res
        .status(200)
        .cookie("accessToken",accessToken.options)
        .cookie("refreshToken",newrefreshToken,options)
        .json(
            new ApiResponse(200,{accessToken,newrefreshToken},"Access token refreshed")
        )
    } catch (error) {
        throw new ApiError(401,error?.message || "Invalid Refresh Token")
    }
})

const updateUser = asyncHandler(async(req,res)=>{
    // find user by id
    // then update through findbyIdandupdate
    // 
})

export {registerUser,loginUser,logoutUser,refreshAccessToken}