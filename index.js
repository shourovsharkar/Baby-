import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import initSqlJs from 'sql.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname=path.dirname(fileURLToPath(import.meta.url));
const app=express();
const PORT=process.env.PORT||4000;
const SECRET=process.env.JWT_SECRET||'dev-only-change-this-secret-before-deploying';
const DB_FILE=path.join(__dirname,'dashboard.sqlite');
const SQL=await initSqlJs();
const db=fs.existsSync(DB_FILE)?new SQL.Database(fs.readFileSync(DB_FILE)):new SQL.Database();
const persist=()=>fs.writeFileSync(DB_FILE,Buffer.from(db.export()));
const run=(sql,params=[])=>db.run(sql,params);
const rows=(sql,params=[])=>{const s=db.prepare(sql);s.bind(params);const out=[];while(s.step())out.push(s.getAsObject());s.free();return out;};
const one=(sql,params=[])=>rows(sql,params)[0]||null;
const now=()=>new Date().toISOString();

run(`CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL,email TEXT UNIQUE NOT NULL,password_hash TEXT NOT NULL,role TEXT NOT NULL DEFAULT 'admin',created_at TEXT NOT NULL)`);
run(`CREATE TABLE IF NOT EXISTS courses(id INTEGER PRIMARY KEY AUTOINCREMENT,title TEXT NOT NULL,description TEXT NOT NULL DEFAULT '',instructor TEXT NOT NULL DEFAULT '',lessons INTEGER NOT NULL DEFAULT 0,students INTEGER NOT NULL DEFAULT 0,price REAL NOT NULL DEFAULT 0,status TEXT NOT NULL DEFAULT 'Draft',published_at TEXT,accent TEXT NOT NULL DEFAULT 'lavender',created_at TEXT NOT NULL)`);
run(`CREATE TABLE IF NOT EXISTS events(id INTEGER PRIMARY KEY AUTOINCREMENT,title TEXT NOT NULL,description TEXT NOT NULL DEFAULT '',event_date TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'Upcoming')`);
run(`CREATE TABLE IF NOT EXISTS approvals(id INTEGER PRIMARY KEY AUTOINCREMENT,title TEXT NOT NULL,kind TEXT NOT NULL,submitted_by TEXT NOT NULL,created_at TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'Pending')`);
run(`CREATE TABLE IF NOT EXISTS activity(id INTEGER PRIMARY KEY AUTOINCREMENT,actor TEXT NOT NULL,action TEXT NOT NULL,detail TEXT NOT NULL,created_at TEXT NOT NULL)`);
run(`CREATE TABLE IF NOT EXISTS notifications(id INTEGER PRIMARY KEY AUTOINCREMENT,title TEXT NOT NULL,body TEXT NOT NULL,read INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL)`);
if(!one('SELECT id FROM users LIMIT 1')){
 const hash=bcrypt.hashSync('Admin123!',10);run('INSERT INTO users(name,email,password_hash,role,created_at) VALUES(?,?,?,?,?)',['Admin User','admin@dashboardv13.com',hash,'admin',now()]);
 const samples=[
 ['Medical Terminology','Understand medical language and terminology for clinical communication.','Annette Black',18,456,149,'Published','2026-10-20','mint'],
 ['Pharmacology Basics','Drug classes, dosage math and safe administration practices.','Duy Hawkins',24,312,179,'Published','2026-10-18','pink'],
 ['Anatomy and Physiology','Human body systems and the structures that sustain life.','Eleanor Pena',32,289,199,'Published','2026-10-12','lavender'],
 ['Medical Ethics and Professionalism','Understand ethical principles and professional conduct in healthcare.','Ellington Thom',12,0,99,'Draft',null,'yellow'],
 ['Disease Pathophysiology','Study the biological mechanisms behind disease and illness.','Brooklyn Simmons',21,0,129,'Draft',null,'mint'],
 ['Patient Communication Lab','Role-play driven training for clear, kind and effective conversations.','Marvin McKinney',9,174,89,'Published','2026-10-05','pink']
 ];
 for(const c of samples)run('INSERT INTO courses(title,description,instructor,lessons,students,price,status,published_at,accent,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)',[...c,now()]);
 for(const e of [['Webinar','Understanding medical research and applying evidence-based guidelines in practice.','2026-11-25T12:30:00','Upcoming'],['Lesson','Overview of healthcare delivery systems, health policy, and their impact on patient care.','2026-11-26T15:00:00','Upcoming'],['Task','Examination of major global health issues, including infectious diseases and non-communicable diseases.','2026-11-27T09:00:00','Upcoming']])run('INSERT INTO events(title,description,event_date,status) VALUES(?,?,?,?)',e);
 for(const a of [['New course submission','Course','Dr. Sarah Miller'],['Instructor application','Instructor','James Wilson'],['Student enrollment request','Student','Ava Johnson']])run('INSERT INTO approvals(title,kind,submitted_by,created_at) VALUES(?,?,?,?)',[...a,now()]);
 run('INSERT INTO activity(actor,action,detail,created_at) VALUES(?,?,?,?)',['Admin User','created','Course Library workspace initialized',now()]);
 run('INSERT INTO notifications(title,body,created_at) VALUES(?,?,?)',['Welcome to Dashboard V13','Your workspace is ready. Explore the course library and admin desk.',now()]);persist();
}
app.use(helmet({crossOriginResourcePolicy:{policy:'cross-origin'}}));app.use(cors({origin:process.env.CLIENT_ORIGIN?.split(',')||true}));app.use(express.json({limit:'1mb'}));app.use('/api',rateLimit({windowMs:15*60*1000,limit:300,standardHeaders:true,legacyHeaders:false}));
const auth=(req,res,next)=>{try{const token=(req.headers.authorization||'').replace(/^Bearer\s+/,'');if(!token)throw new Error('Missing token');req.user=jwt.verify(token,SECRET);next();}catch{return res.status(401).json({error:'Please sign in again.'});}};
const admin=(req,res,next)=>req.user?.role==='admin'?next():res.status(403).json({error:'Administrator access required.'});
const log=(action,detail,actor='Admin User')=>{run('INSERT INTO activity(actor,action,detail,created_at) VALUES(?,?,?,?)',[actor,action,detail,now()]);persist();};
app.get('/api/health',(req,res)=>res.json({ok:true,service:'Dashboard V13 API'}));
app.post('/api/auth/login',(req,res)=>{const {email,password}=req.body||{};if(!email||!password)return res.status(400).json({error:'Email and password are required.'});const u=one('SELECT * FROM users WHERE email=?',[String(email).toLowerCase().trim()]);if(!u||!bcrypt.compareSync(password,u.password_hash))return res.status(401).json({error:'Invalid email or password.'});const token=jwt.sign({id:u.id,name:u.name,email:u.email,role:u.role},SECRET,{expiresIn:'12h'});res.json({token,user:{id:u.id,name:u.name,email:u.email,role:u.role}});});
app.get('/api/auth/me',auth,(req,res)=>res.json({user:req.user}));
app.get('/api/dashboard',auth,(req,res)=>{const courses=rows('SELECT * FROM courses ORDER BY id DESC');const stats=one(`SELECT COUNT(*) total, SUM(CASE WHEN status='Published' THEN 1 ELSE 0 END) published, SUM(CASE WHEN status='Draft' THEN 1 ELSE 0 END) drafts, COALESCE((SELECT SUM(price*students) FROM courses),0) revenue FROM courses`);res.json({stats,courses,events:rows('SELECT * FROM events ORDER BY event_date LIMIT 5'),approvals:rows("SELECT * FROM approvals WHERE status='Pending' ORDER BY id DESC LIMIT 5"),activity:rows('SELECT * FROM activity ORDER BY id DESC LIMIT 8'),notifications:rows('SELECT * FROM notifications ORDER BY id DESC LIMIT 8')});});
app.get('/api/courses',auth,(req,res)=>{const {q='',status='All',sort='newest'}=req.query;let sql='SELECT * FROM courses WHERE (title LIKE ? OR instructor LIKE ? OR description LIKE ?)';const p=[`%${q}%`,`%${q}%`,`%${q}%`];if(status!=='All'){sql+=' AND status=?';p.push(status);}sql+=sort==='title'?' ORDER BY title ASC':sort==='price'?' ORDER BY price DESC':' ORDER BY id DESC';res.json(rows(sql,p));});
app.post('/api/courses',auth,admin,(req,res)=>{const c=req.body||{};if(!c.title?.trim())return res.status(400).json({error:'Course title is required.'});run('INSERT INTO courses(title,description,instructor,lessons,students,price,status,published_at,accent,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)',[c.title.trim(),c.description||'',c.instructor||'Unassigned',Math.max(0,Number(c.lessons)||0),Math.max(0,Number(c.students)||0),Math.max(0,Number(c.price)||0),c.status||'Draft',c.status==='Published'?now():null,c.accent||'lavender',now()]);persist();const item=one('SELECT * FROM courses WHERE id=last_insert_rowid()');log('created',`Course: ${item.title}`,req.user.name);res.status(201).json(item);});
app.put('/api/courses/:id',auth,admin,(req,res)=>{const old=one('SELECT * FROM courses WHERE id=?',[Number(req.params.id)]);if(!old)return res.status(404).json({error:'Course not found.'});const c={...old,...req.body};if(!String(c.title||'').trim())return res.status(400).json({error:'Course title is required.'});run('UPDATE courses SET title=?,description=?,instructor=?,lessons=?,students=?,price=?,status=?,published_at=?,accent=? WHERE id=?',[c.title,c.description||'',c.instructor||'Unassigned',Math.max(0,Number(c.lessons)||0),Math.max(0,Number(c.students)||0),Math.max(0,Number(c.price)||0),c.status,c.status==='Published'?(old.published_at||now()):null,c.accent||'lavender',old.id]);persist();const item=one('SELECT * FROM courses WHERE id=?',[old.id]);log('updated',`Course: ${item.title}`,req.user.name);res.json(item);});
app.delete('/api/courses/:id',auth,admin,(req,res)=>{const c=one('SELECT * FROM courses WHERE id=?',[Number(req.params.id)]);if(!c)return res.status(404).json({error:'Course not found.'});run('DELETE FROM courses WHERE id=?',[c.id]);persist();log('deleted',`Course: ${c.title}`,req.user.name);res.json({ok:true});});
app.patch('/api/approvals/:id',auth,admin,(req,res)=>{const {status}=req.body||{};if(!['Approved','Rejected'].includes(status))return res.status(400).json({error:'Invalid approval status.'});const a=one('SELECT * FROM approvals WHERE id=?',[Number(req.params.id)]);if(!a)return res.status(404).json({error:'Request not found.'});run('UPDATE approvals SET status=? WHERE id=?',[status,a.id]);persist();log(status.toLowerCase(),`${a.kind}: ${a.title}`,req.user.name);res.json(one('SELECT * FROM approvals WHERE id=?',[a.id]));});
app.post('/api/events',auth,admin,(req,res)=>{const {title,description='',event_date}=req.body||{};if(!title||!event_date)return res.status(400).json({error:'Event title and date are required.'});run('INSERT INTO events(title,description,event_date,status) VALUES(?,?,?,?)',[title,description,event_date,'Upcoming']);persist();log('scheduled',`Event: ${title}`,req.user.name);res.status(201).json(one('SELECT * FROM events WHERE id=last_insert_rowid()'));});
app.patch('/api/notifications/read-all',auth,(req,res)=>{run('UPDATE notifications SET read=1');persist();res.json({ok:true});});
if(process.env.NODE_ENV==='production'){const dist=path.join(__dirname,'../dist');app.use(express.static(dist));app.get('*',(req,res)=>res.sendFile(path.join(dist,'index.html')));}
app.listen(PORT,()=>console.log(`Dashboard V13 API running on http://localhost:${PORT}`));
