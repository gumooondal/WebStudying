const express = require('express')
const app = express()
const methodOverride = require('method-override')
const bcrypt = require('bcrypt')
const MongoStore = require('connect-mongo')
require('dotenv').config()

app.use(methodOverride('_method')) 
app.use(express.static(__dirname +'/public'))
app.set('view engine', 'ejs')
app.use(express.json())
app.use(express.urlencoded({extended:true}))

// passport라이브러리
const session = require('express-session')
const passport = require('passport')
const LocalStrategy = require('passport-local')

app.use(passport.initialize())
app.use(session({
  secret: '암호화에 쓸 비번',
  resave : false,
  saveUninitialized : false,
  cookie : { maxAge : 60 * 60 * 1000},
  store : MongoStore.create({
    mongoUrl : process.env.DB_URL,
    dbName : 'forum'
  })
}))

app.use(passport.session())
// ---

const { MongoClient, ObjectId } = require('mongodb')

let db
const url = process.env.DB_URL
new MongoClient(url).connect().then((client)=>{
  console.log('DB연결성공')
  db = client.db('forum')
  app.listen(process.env.PORT, () => {
    console.log('http://localhost:'+process.env.PORT+' 에서 서버 실행중')
})

}).catch((err)=>{
  console.log(err)
})

app.get('/', (요청, 응답) => {
  응답.sendFile(__dirname + '/index.html')
}) 

passport.use(new LocalStrategy(async (입력한아이디, 입력한비번, cb) => {
  let result = await db.collection('user').findOne({ username : 입력한아이디})
  if (!result) {
    return cb(null, false, { message: '아이디 DB에 없음' })
  }

 
  if ( await bcrypt.compare(입력한비번, result.password)) {
    return cb(null, result) 
  } else {
    return cb(null, false, { message: '비번불일치' });
  }
}))

passport.serializeUser((user, done) => {
  process.nextTick(() => {
    done(null, { id: user._id, username: user.username })
  })
})

passport.deserializeUser(async(user, done) => {
  let result = await db.collection('user').findOne({_id : new ObjectId(user.id) })
  delete result.password
  process.nextTick(() => {
    return done(null, result)
  })
})

app.get('/login', (요청, 응답)=>{
  console.log(요청.user)
  응답.render('login.ejs')
}) 

app.get('/login2', (요청, 응답)=>{
  응답.render('login2.ejs')
}) 

app.post('/login', async (요청, 응답, next) => {
  let username = 요청.body.username;
  let result = await db.collection('user').findOne({username: username});

  passport.authenticate('local', (error, user, info) => {
      if (error) return 응답.status(500).json(error)
      if (!user) return 응답.status(401).json(info.message)
      요청.logIn(user, (err) => {
        if (err) return next(err)
        응답.render('afterLogin.ejs', {user : result})
      })
  })(요청, 응답, next)

})

app.get('/register', (요청, 응답)=>{
  응답.render('register.ejs')
})

app.post('/register', async (요청, 응답)=>{
  let username = 요청.body.username;
  let 해시 = await bcrypt.hash(요청.body.password, 10)

  await db.collection('user').insertOne({
    username : 요청.body.username,
    password : 해시
  })
  응답.render('afterLogin.ejs', { user: { username: username } });
})

app.get('/user',async (요청, 응답) =>{
  let result = await db.collection('user').find().toArray()
  응답.render('user.ejs', {user : result})
})