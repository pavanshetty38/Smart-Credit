import {Router} from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import {auth} from '../middleware/auth.js';
const router=Router();
const tokenFor=u=>jwt.sign({id:u._id},process.env.JWT_SECRET,{expiresIn:'7d'});

router.post('/register',async(req,res)=>{
  try{
    const {name,email,password,role='customer',phone='',address=''}=req.body;
    if(!name||!email||!password) return res.status(400).json({message:'Name, email and password are required'});
    if(!['customer','merchant'].includes(role)) return res.status(400).json({message:'Invalid role'});
    if(await User.findOne({email:email.toLowerCase()})) return res.status(409).json({message:'Email already registered'});
    const user=await User.create({name,email,password:await bcrypt.hash(password,12),role,phone,address});
    res.status(201).json({token:tokenFor(user),user:{id:user._id,name:user.name,email:user.email,role:user.role,kycStatus:user.kycStatus}});
  }catch(e){res.status(500).json({message:e.message});}
});
router.post('/login',async(req,res)=>{
  const user=await User.findOne({email:req.body.email?.toLowerCase()});
  if(!user||!(await bcrypt.compare(req.body.password||'',user.password))) return res.status(401).json({message:'Invalid email or password'});
  res.json({token:tokenFor(user),user:{id:user._id,name:user.name,email:user.email,role:user.role,kycStatus:user.kycStatus}});
});
router.get('/me',auth,async(req,res)=>res.json({user:req.user}));
export default router;
