import React, {useEffect, useMemo, useState} from "react";
import {Routes, Route, Link, useNavigate, useParams, Navigate} from "react-router-dom";
import {onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, updateProfile} from "firebase/auth";
import {ref, onValue, push, set, update, runTransaction, serverTimestamp} from "firebase/database";
import {ref as sRef, uploadBytes, getDownloadURL} from "firebase/storage";
import {auth, db, storage} from "./firebase";
import {Search, LogIn, LogOut, Plus, CarFront, Clock, Gavel, UserPlus, X, ImagePlus, Pencil, ChevronLeft, ChevronRight} from "lucide-react";

const damageInfo = {
  verde:{label:"Daño menor / Limpio", color:"#20a464"},
  amarillo:{label:"Daño medio / Reparable", color:"#f2b84b"},
  rojo:{label:"Daño severo / Salvamento", color:"#e05252"}
};

function useVehicles(){
  const [vehicles,setVehicles]=useState([]);
  useEffect(()=>onValue(ref(db,"vehicles"), snap=>{
    const data=snap.val()||{};
    setVehicles(Object.entries(data).map(([id,v])=>({id,...v})).sort((a,b)=>(a.startAt||0)-(b.startAt||0)));
  }),[]);
  return vehicles;
}

function Layout({user}){
 const navigate=useNavigate();
 return <header className="topbar"><Link className="brand" to="/"><span className="logo">AB</span><span>AutoBid <b>GT</b></span></Link>
 <nav><Link to="/">Inventario</Link>{user&&<Link to="/publicar">Publicar vehículo</Link>}{user&&<Link to="/mis-publicaciones">Mis publicaciones</Link>}</nav>
 <div className="authArea">{user?<><span className="userPill">{user.displayName||user.email}</span><button className="ghost" onClick={async()=>{await signOut(auth);navigate("/")}}><LogOut size={16}/>Salir</button></>:<Link className="btn small" to="/login"><LogIn size={16}/>Ingresar</Link>}</div>
 </header>
}

function App(){
 const [user,setUser]=useState(null);
 const vehicles=useVehicles();
 useEffect(()=>onAuthStateChanged(auth,setUser),[]);
 return <><Layout user={user}/><main><Routes>
  <Route path="/" element={<Home vehicles={vehicles}/>}/>
  <Route path="/login" element={user?<Navigate to="/"/>:<Login/>}/>
  <Route path="/registro" element={user?<Navigate to="/"/>:<Register/>}/>
  <Route path="/vehiculo/:id" element={<Auction vehicles={vehicles} user={user}/>}/>
  <Route path="/publicar" element={user?<Publish user={user}/>:<Navigate to="/login"/>}/>
  <Route path="/mis-publicaciones" element={user?<MyPosts vehicles={vehicles}/>:<Navigate to="/login"/>}/><Route path="/editar/:id" element={user?<EditPost vehicles={vehicles} user={user}/>:<Navigate to="/login"/>}/>
  <Route path="*" element={<Navigate to="/"/>}/>
 </Routes></main><footer>AutoBid GT · Plataforma académica de subastas en tiempo real</footer></>
}

function Home({vehicles}){
 const [q,setQ]=useState(""); const [brand,setBrand]=useState(""); const [damage,setDamage]=useState(""); const [fuel,setFuel]=useState("");
 const now=Date.now();
 const brands=[...new Set(vehicles.map(v=>v.brand).filter(Boolean))].sort();
 const filtered=useMemo(()=>vehicles.filter(v=>{
   const text=`${v.brand} ${v.model} ${v.year} ${v.itemType}`.toLowerCase();
   return text.includes(q.toLowerCase()) && (!brand||v.brand===brand)&&(!damage||v.damage===damage)&&(!fuel||v.fuel===fuel);
 }),[vehicles,q,brand,damage,fuel]);
 return <section>
  <div className="hero"><div><span className="eyebrow">SUBASTAS EN TIEMPO REAL</span><h1>Encuentra tu próximo vehículo.</h1><p>Explora inventario, revisa daños y participa en pujas sin recargar la página.</p><div className="search"><Search size={19}/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Busca marca, modelo, año..."/></div></div><div className="heroArt"><CarFront size={100}/><span>LIVE AUCTIONS</span></div></div>
  <div className="filters"><select value={brand} onChange={e=>setBrand(e.target.value)}><option value="">Todas las marcas</option>{brands.map(x=><option key={x}>{x}</option>)}</select><select value={damage} onChange={e=>setDamage(e.target.value)}><option value="">Todos los daños</option><option value="verde">🟢 Verde</option><option value="amarillo">🟡 Amarillo</option><option value="rojo">🔴 Rojo</option></select><select value={fuel} onChange={e=>setFuel(e.target.value)}><option value="">Todo combustible</option><option>Gasolina</option><option>Diésel</option><option>Híbrido</option><option>Eléctrico</option></select><span className="resultCount">{filtered.length} vehículos</span></div>
  <div className="grid">{filtered.map(v=><VehicleCard key={v.id} v={v} now={now}/>)}</div>
  {!filtered.length&&<div className="empty">No hay vehículos con esos filtros.</div>}
 </section>
}

function VehicleCard({v,now}){
 const closed=now>=v.endAt; const img=v.images?.[0];
 return <Link className="card" to={`/vehiculo/${v.id}`}><div className="photo">{img?<img src={img} alt={v.brand+" "+v.model}/>:<CarFront size={56}/>}<span className="damage" style={{background:damageInfo[v.damage]?.color}}>{damageInfo[v.damage]?.label||v.damage}</span></div><div className="cardBody"><div className="muted">{v.year} · {v.itemType}</div><h3>{v.brand} {v.model}</h3><p>{v.transmission} · {v.fuel} · {v.drivetrain}</p><div className="bidLine"><div><small>Oferta actual</small><strong>Q {Number(v.currentBid||v.basePrice).toLocaleString("es-GT")}</strong></div><span className={closed?"closed":"live"}>{closed?"CERRADA":"EN VIVO"}</span></div></div></Link>
}

function Login() {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [err, setErr] = useState("");

  async function submit(e) {
    e.preventDefault();
    setErr("");

    try {
      await signInWithEmailAndPassword(auth, email, pass);
      nav("/");
    } catch (e) {
      setErr("Correo o contraseña incorrectos.");
    }
  }

  return (
    <AuthBox
      title="Bienvenido de nuevo"
      subtitle="Ingresa para participar en las subastas."
      onSubmit={submit}
      button="Ingresar"
      err={err}
      fields={
        <>
          <input
            required
            type="email"
            placeholder="Correo electrónico"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <input
            required
            type="password"
            placeholder="Contraseña"
            value={pass}
            onChange={(e) => setPass(e.target.value)}
          />
        </>
      }
    >
      <p>
        ¿No tienes cuenta? <Link to="/registro">Regístrate</Link>
      </p>
    </AuthBox>
  );
}
function Register() {
  const nav = useNavigate();

  const [f, setF] = useState({
    name: "",
    last: "",
    email: "",
    phone: "",
    pass: ""
  });

  const [err, setErr] = useState("");

  async function submit(e) {
    e.preventDefault();
    setErr("");

    try {
      const c = await createUserWithEmailAndPassword(
        auth,
        f.email,
        f.pass
      );

      await updateProfile(c.user, {
        displayName: `${f.name} ${f.last}`
      });

      await set(ref(db, `users/${c.user.uid}`), {
        name: f.name,
        lastName: f.last,
        email: f.email,
        phone: f.phone
      });

      nav("/");
    } catch (e) {
      setErr(
        e.code === "auth/email-already-in-use"
          ? "Ese correo ya está registrado."
          : "No se pudo crear la cuenta."
      );
    }
  }

  return (
    <AuthBox
      title="Crear cuenta"
      subtitle="Regístrate para publicar y ofertar."
      onSubmit={submit}
      button="Crear cuenta"
      err={err}
      fields={
        <>
          <input
            required
            placeholder="Nombre"
            value={f.name}
            onChange={(e) =>
              setF({ ...f, name: e.target.value })
            }
          />

          <input
            required
            placeholder="Apellido"
            value={f.last}
            onChange={(e) =>
              setF({ ...f, last: e.target.value })
            }
          />

          <input
            required
            type="email"
            placeholder="Correo electrónico"
            value={f.email}
            onChange={(e) =>
              setF({ ...f, email: e.target.value })
            }
          />

          <input
            required
            placeholder="Teléfono"
            value={f.phone}
            onChange={(e) =>
              setF({ ...f, phone: e.target.value })
            }
          />

          <input
            required
            minLength="6"
            type="password"
            placeholder="Contraseña segura (mín. 6)"
            value={f.pass}
            onChange={(e) =>
              setF({ ...f, pass: e.target.value })
            }
          />
        </>
      }
    >
      <p>
        ¿Ya tienes cuenta? <Link to="/login">Ingresar</Link>
      </p>
    </AuthBox>
  );
}
function AuthBox({title,subtitle,onSubmit,button,fields,err,children}){return <section className="authPage"><form className="authBox" onSubmit={onSubmit}><span className="eyebrow">AUTOBID GT</span><h1>{title}</h1><p>{subtitle}</p>{fields}{err&&<div className="error">{err}</div>}<button className="btn">{button}</button>{children}</form></section>}

function Publish({user,edit=false,initial=null}){
 const nav=useNavigate(); const [f,setF]=useState(initial||{year:"2022",itemType:"Automóvil",brand:"Toyota",model:"Corolla",engine:"2.0",transmission:"Automática",fuel:"Gasolina",drivetrain:"FWD",cylinders:"4",damage:"verde",basePrice:"20000",startLocal:"",endLocal:""}); const [files,setFiles]=useState([]);const [saving,setSaving]=useState(false);const [msg,setMsg]=useState("");
 function change(k,v){setF(x=>({...x,[k]:v}))}
 async function submit(e){e.preventDefault();setMsg("");if(!edit&&files.length<5){setMsg("Debes seleccionar mínimo 5 fotografías.");return} if(Number(f.basePrice)<20000){setMsg("El monto base mínimo del examen es Q 20,000.");return} if(new Date(f.endLocal)<=new Date(f.startLocal)){setMsg("La fecha de cierre debe ser posterior al inicio.");return}setSaving(true);try{let images=initial?.images||[];for(const file of files){const path=`vehicles/${user.uid}/${Date.now()}-${file.name}`;const s=await uploadBytes(sRef(storage,path),file);images.push(await getDownloadURL(s.ref))}const startAt=new Date(f.startLocal).getTime(), endAt=new Date(f.endLocal).getTime();const data={year:Number(f.year),itemType:f.itemType,brand:f.brand,model:f.model,engine:f.engine,transmission:f.transmission,fuel:f.fuel,drivetrain:f.drivetrain,cylinders:Number(f.cylinders),damage:f.damage,images,basePrice:Number(f.basePrice),currentBid:Number(initial?.currentBid||f.basePrice),startAt,endAt,sellerId:user.uid,sellerName:user.displayName||user.email,updatedAt:serverTimestamp()};if(edit){await update(ref(db,`vehicles/${initial.id}`),data)}else{const r=push(ref(db,"vehicles"));await set(r,{...data,createdAt:serverTimestamp()})}nav(edit?"/mis-publicaciones":`/vehiculo/${initial?.id||""}`)}catch(e){setMsg("No se pudo guardar. Revisa Firebase Storage y las reglas.")}finally{setSaving(false)}}
 const fields=[["year","Año"],["itemType","Tipo de artículo"],["brand","Marca"],["model","Modelo"],["engine","Motor"],["transmission","Transmisión"],["fuel","Combustible"],["drivetrain","Tren de manejo"],["cylinders","Cilindros"],["basePrice","Monto base (Q)"]];
 return <section><div className="pageTitle"><span className="eyebrow">PROVEEDOR / USUARIO</span><h1>{edit?"Editar publicación":"Publicar vehículo"}</h1></div><form className="vehicleForm" onSubmit={submit}><div className="formGrid">{fields.map(([k,l])=><label key={k}>{l}<input required type={k==="year"||k==="cylinders"||k==="basePrice"?"number":"text"} value={f[k]} onChange={e=>change(k,e.target.value)}/></label>)}<label>Clasificación de daño<select value={f.damage} onChange={e=>change("damage",e.target.value)}><option value="verde">🟢 Verde — Menor / Limpio</option><option value="amarillo">🟡 Amarillo — Medio / Reparable</option><option value="rojo">🔴 Rojo — Severo / Salvamento</option></select></label><label>Inicio de subasta<input required type="datetime-local" value={f.startLocal} onChange={e=>change("startLocal",e.target.value)}/></label><label>Cierre de subasta<input required type="datetime-local" value={f.endLocal} onChange={e=>change("endLocal",e.target.value)}/></label></div><label className="upload"><ImagePlus/> Fotografías (mínimo 5)<input required={!edit} type="file" accept="image/*" multiple onChange={e=>setFiles([...e.target.files])}/><small>{files.length} nuevas seleccionadas {edit&&"· Las existentes se conservan"}</small></label>{msg&&<div className="error">{msg}</div>}<button disabled={saving} className="btn">{saving?"Guardando...":edit?"Guardar cambios":"Publicar vehículo"}</button></form></section>
}

function Auction({vehicles,user}){
 const {id}=useParams();const v=vehicles.find(x=>x.id===id);const [bid,setBid]=useState("");const [now,setNow]=useState(Date.now());const [notice,setNotice]=useState("");const [index,setIndex]=useState(0);
 useEffect(()=>{const t=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(t)},[]);
 useEffect(()=>{if(!v)return; if(!user)return;},[v,user]);
 if(!v)return <div className="empty">Vehículo no encontrado.</div>;
 const started=now>=v.startAt, closed=now>=v.endAt, min=Math.max(v.basePrice,(v.currentBid||v.basePrice)*1.10); const leading=v.currentBidderId===user?.uid;
 async function placeBid(e){e.preventDefault();setNotice("");if(!user){setNotice("Debes iniciar sesión para ofertar.");return}if(!started||closed){setNotice("La subasta no está disponible.");return}const amount=Number(bid);if(!Number.isFinite(amount)||amount<min){setNotice(`La oferta mínima es Q ${Math.ceil(min).toLocaleString("es-GT")}.`);return}const result=await runTransaction(ref(db,`vehicles/${id}`),current=>{if(!current)return current;const t=Date.now();const minimum=Math.max(Number(current.basePrice||0),Number(current.currentBid||current.basePrice||0)*1.10);if(t<Number(current.startAt)||t>=Number(current.endAt)||amount<minimum)return;return {...current,currentBid:amount,currentBidderId:user.uid,updatedAt:serverTimestamp()}});if(result.committed){setBid("");setNotice("¡Oferta registrada correctamente!")}else setNotice("La oferta no fue aceptada. El precio cambió o la subasta terminó.")}
 const remaining=Math.max(0,v.endAt-now);const mins=Math.floor(remaining/60000), secs=Math.floor((remaining%60000)/1000);const currentImg=v.images?.[index]||v.images?.[0];
 return <section><Link className="back" to="/">← Volver al inventario</Link><div className="auction"><div className="gallery"><div className="mainImage">{currentImg?<img src={currentImg} alt="Vehículo"/>:<CarFront size={100}/>}<span className="damage" style={{background:damageInfo[v.damage]?.color}}>{damageInfo[v.damage]?.label}</span></div><div className="thumbs">{(v.images||[]).map((im,i)=><button key={im} onClick={()=>setIndex(i)} className={i===index?"active":""}><img src={im} alt="foto"/></button>)}</div></div><div className="auctionInfo"><span className="eyebrow">{closed?"SUBASTA CERRADA":started?"SUBASTA EN VIVO":"PRÓXIMAMENTE"}</span><h1>{v.brand} {v.model}</h1><p className="muted">{v.year} · {v.itemType}</p><div className="timer"><Clock/><div><small>{closed?"Finalizada":"Tiempo restante"}</small><strong>{closed?"CERRADA":`${String(Math.floor(remaining/3600000)).padStart(2,"0")}:${String(mins%60).padStart(2,"0")}:${String(secs).padStart(2,"0")}`}</strong></div></div><div className="current"><small>OFERTA ACTUAL MÁS ALTA</small><strong>Q {Number(v.currentBid||v.basePrice).toLocaleString("es-GT")}</strong></div>{user&&started&&!closed&&(leading?<div className="success">✓ ¡Vas ganando esta subasta!</div>:v.currentBidderId?<div className="outbid">Tu oferta ha sido superada. ¡Haz tu oferta!</div>:null)}{!user&&<div className="info">Inicia sesión para ofertar.</div>}<form className="bidForm" onSubmit={placeBid}><input disabled={!user||!started||closed} type="number" min={Math.ceil(min)} step="1" placeholder={`Mínimo Q ${Math.ceil(min).toLocaleString("es-GT")}`} value={bid} onChange={e=>setBid(e.target.value)}/><button disabled={!user||!started||closed} className="btn"><Gavel size={17}/> Ofertar</button></form>{notice&&<div className="error">{notice}</div>}<div className="specs">{[["Motor",v.engine],["Transmisión",v.transmission],["Combustible",v.fuel],["Tren",v.drivetrain],["Cilindros",v.cylinders],["Daño",damageInfo[v.damage]?.label]].map(([a,b])=><div key={a}><small>{a}</small><b>{b}</b></div>)}</div></div></div></section>
}

function EditPost({vehicles,user}){
 const {id}=useParams(); const v=vehicles.find(x=>x.id===id);
 if(!v||v.sellerId!==user.uid)return <div className="empty">Publicación no encontrada o no autorizada.</div>;
 const initial={...v,startLocal:new Date(v.startAt).toISOString().slice(0,16),endLocal:new Date(v.endAt).toISOString().slice(0,16)};
 return <Publish user={user} edit initial={initial}/>;
}
function MyPosts({vehicles}){
 const mine=vehicles.filter(v=>v.sellerId===auth.currentUser?.uid);return <section><div className="pageTitle"><span className="eyebrow">GESTIÓN</span><h1>Mis publicaciones</h1></div><div className="grid">{mine.map(v=><div key={v.id} className="card"><VehicleCard v={v} now={Date.now()}/><Link className="editLink" to={`/editar/${v.id}`}>Editar</Link></div>)}</div>{!mine.length&&<div className="empty">Aún no has publicado vehículos.</div>}</section>
}

export default App;