const express=require('express')
const cors=require('cors')
const jwt=require('jsonwebtoken')
const cookieParser=require('cookie-parser')
require('dotenv').config()
const { MongoClient, ServerApiVersion,ObjectId  } = require('mongodb');
const app=express()
const port=process.env.PORT || 5000;


const uri = "mongodb+srv://library:4pqSeoDSFz8SVrVE@cluster0.iwcqk.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";

const corsOptions = {
    origin: [
      'http://localhost:5173',
      'http://localhost:5174',
      
    ], 
    credentials: true,
}

app.use(cors(corsOptions))
// app.use(cors())
app.use(express.json())
app.use(cookieParser())

const client = new MongoClient(uri, {
    serverApi: {
      version: ServerApiVersion.v1,
      strict: true,
      deprecationErrors: true,
    }
  });


  //verify token
  const verifyToken=(req,res,next)=>{
    const token=req?.cookies?.token;
    console.log('token in the middleware', token);
    if(!token){
      return res.status(401).send({message: 'unauthorized access!!'})
    }
    jwt.verify(token,process.env.ACCESS_TOKEN_SECRET,(err,decoded)=>{
      if(err){
        return res.status(403).send({message: 'invalid token'})
      }
      req.user=decoded;
      // console.log('form verify token',req.user);
      next()
    }) 
  }

  async function run() {
    try {
        const booksCollection=client.db('library').collection('books')
        const bookingsCollection=client.db('library').collection('bookings')
        const usersCollection=client.db('library').collection('users')

        const verifyHost = async (req, res, next) => {
          console.log('hello')
          const user = req.user
          const query = { email: user?.email }
          const result = await usersCollection.findOne(query)
          console.log(result?.role)
          if (!result || result?.role !== 'author')
            return res.status(401).send({ message: 'unauthorized access!!' })
          next()
        }

        //auth related api also generate token
        //when login token create
        app.post('/jwt', async(req, res) => {
          const user = req.body;
          console.log('user for token', user);
          const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });

          res.cookie('token', token, {
              httpOnly: true,
              secure: true,
              sameSite: 'none'
          })
              .send({ success: true });
      })

      //log out tokn delete 
      app.post('/logout',async(req,res)=>{
        const user=req.body
        console.log('log out user',user);
        res.clearCookie('token',{maxAge:0}).send({success:true})
      })

        //requested for change reader role to author 
        app.put('/readerChange/:email',async(req,res)=>{
          const email = req.params.email
          const reader = req.body
          const query = { email }
          const updateDoc = {
            $set: {status:'Requested'},
          }
          const result = await usersCollection.updateOne(query, updateDoc)
          res.send(result)
        })

        //update user role
    app.patch('/users/update/:email', async (req, res) => {
      const email = req.params.email
      const user = req.body
      const query = { email  }
      // console.log(user);
      // console.log(query);
      const updateDoc = {
        $set: { ...user},
      }
      const result = await usersCollection.updateOne(query, updateDoc)
      res.send(result)
    })


    //get a user info by email from db for role
    app.get('/user/:email',async(req,res)=>{
      const email=req.params.email;
      const query={email:email}
      // console.log(query);
      const result=await usersCollection.findOne(query)
      res.send(result)
    })


    //show all user for admin
    app.get('/users',async(req,res)=>{
      const users=req.body
      const result=await usersCollection.find().toArray()
      res.send(result)
    })

    //delete book user
    app.delete('/booking/:id',async(req,res)=>{
      const id=req.params.id;
      const result=await bookingsCollection.deleteOne({_id:new ObjectId(id)})
      res.send(result)
    })

      //show all the book 
      app.get('/books',async(req,res)=>{
        const books=req.body
        const result=await booksCollection.find().toArray()
        res.send(result)
      })


      //save book data in db
      app.post('/book',async (req,res)=>{
        const bookData=req.body;
        const result=await booksCollection.insertOne(bookData)
        res.send(result)
      })

      //show book that host added
      app.get('/book/:email',async(req,res)=>{
        const email=req.params.email
        const query={'author.email':email}
        const result=await booksCollection.find(query).toArray()
        res.send(result)
      })

      //show user booking data by specific user by email
      app.get('/booking/:email',verifyToken,async(req,res)=>{
        const email=req.params.email
        const query={'reader.email':email}

        console.log('token owner info',req.user.email);
        console.log('api carry email',email); 

        if(email !== req.user.email){
          return res.status(403).send({message: 'forbidden access'})
      }
        const result=await bookingsCollection.find(query).toArray()
        res.send(result)
      })

      //delete book data as a host there added book
      app.delete('/book/:id',async(req,res)=>{
        const id=req.params.id;
        const result=await booksCollection.deleteOne({_id:new ObjectId(id)})
        res.send(result)
      })

        // update book data
        app.put('/book/update/:id',async (req, res) => {
          const id = req.params.id
          const bookData = req.body
          const query = { _id: new ObjectId(id) }
          const updateDoc = {
            $set: bookData,
          }
          const result = await booksCollection.updateOne(query, updateDoc)
          res.send(result)
        }) 

        //save a book in server site 
        app.post('/booking',async(req,res)=>{
          const bookingData=req.body;
          const result=await bookingsCollection.insertOne(bookingData)
          res.send(result)
        })

        //save users in db 
        app.put('/user',async (req,res)=>{
          const user=req.body;
          const query={email:user?.email}
          //check if user already exists in db
          const isExists=await usersCollection.findOne(query)
          if(isExists){
            if(user.status==='Requested'){
                 // if existing user try to change his role
                 const result = await usersCollection.updateOne(query, {
                  $set: { status: user?.status },
                })
                return res.send(result)
            }
            else
            {
              // if existing user login again
              return res.send(isExists)
            }
            
          }
    
          //jodi user khuje na pai tahole option diye notun user add kore dibe
          //save user for the first time
          const options={upsert:true}
          const updateDoc={
            $set:{
              ...user,
              
            },
          }
          const  result=await usersCollection.updateOne(query,updateDoc,options)
        
          res.send(result)
        })
    

      await client.connect();
      // Send a ping to confirm a successful connection
      await client.db("admin").command({ ping: 1 });
      console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
      // Ensures that the client will close when you finish/error 
      
    }
  }
  run().catch(console.dir);

app.get('/',(req,res)=>{
    res.send('hello from library server site')
})


app.listen(port,console.log(`server is running on port ${port}`))






