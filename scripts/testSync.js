import fetch from 'node-fetch';

(async ()=>{
  try{
    const res = await fetch('http://localhost:3000/api/sync',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({action:'sync',withdrawals:[]})
    });
    console.log('status',res.status);
    console.log(await res.text());
  } catch(e){
    console.error('fetch error', e);
  }
})();
