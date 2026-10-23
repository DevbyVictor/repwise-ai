/* Halter em WebGL: geometria, materiais e iluminação locais, sem downloads. */
(() => {
  'use strict';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const scenes = new Map();
  const multiply = (a,b) => {
    const out = new Float32Array(16);
    for(let c=0;c<4;c++) for(let r=0;r<4;r++) for(let k=0;k<4;k++) out[c*4+r]+=a[k*4+r]*b[c*4+k];
    return out;
  };
  function rotation(x,y,z) {
    const a=Math.cos(x),b=Math.sin(x),c=Math.cos(y),d=Math.sin(y),e=Math.cos(z),f=Math.sin(z);
    return new Float32Array([c*e,a*f+b*d*e,b*f-a*d*e,0,-c*f,a*e-b*d*f,b*e+a*d*f,0,d,-b*c,a*c,0,0,0,0,1]);
  }
  function perspective(aspect) {
    const f=1/Math.tan(.66/2),near=.1,far=50;
    return new Float32Array([f/aspect,0,0,0,0,f,0,0,0,0,(far+near)/(near-far),-1,0,0,2*far*near/(near-far),0]);
  }
  function lathe(profile, segments=56) {
    const positions=[],normals=[];
    for(let p=0;p<profile.length-1;p++) {
      const [x0,r0]=profile[p],[x1,r1]=profile[p+1],dx=x1-x0,dr=r1-r0,len=Math.hypot(dx,dr)||1;
      for(let i=0;i<segments;i++) {
        const a=i/segments*Math.PI*2,b=(i+1)/segments*Math.PI*2;
        for(const [x,r,angle] of [[x0,r0,a],[x1,r1,a],[x1,r1,b],[x0,r0,a],[x1,r1,b],[x0,r0,b]]) {
          positions.push(x,r*Math.cos(angle),r*Math.sin(angle));normals.push(-dr/len,dx/len*Math.cos(angle),dx/len*Math.sin(angle));
        }
      }
    }
    return {positions:new Float32Array(positions),normals:new Float32Array(normals)};
  }
  function cylinder(center,width,radius) {
    const l=center-width/2,r=center+width/2,bevel=Math.min(width*.22,.045);
    return lathe([[l,0],[l,radius*.9],[l+bevel,radius],[r-bevel,radius],[r,radius*.9],[r,0]]);
  }
  function create(holder) {
    const canvas=document.createElement('canvas');canvas.className='training-canvas';canvas.setAttribute('aria-hidden','true');
    let gl;
    try { gl=canvas.getContext('webgl',{alpha:true,antialias:true,premultipliedAlpha:false,powerPreference:'low-power'}); } catch {}
    if(!gl) { holder.dataset.renderer='svg'; return null; }
    const buffers=[];let program;
    try {
      const shader=(type,source)=>{const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error('Shader unavailable');return s;};
      const vs=shader(gl.VERTEX_SHADER,`attribute vec3 aPosition;attribute vec3 aNormal;uniform mat4 uModel;uniform mat4 uProjection;varying vec3 vNormal;varying vec3 vPosition;void main(){vec4 p=uModel*vec4(aPosition,1.0);vPosition=p.xyz;vNormal=mat3(uModel)*aNormal;gl_Position=uProjection*p;}`);
      const fs=shader(gl.FRAGMENT_SHADER,`precision mediump float;varying vec3 vNormal;varying vec3 vPosition;uniform vec3 uColor;uniform float uGlow;void main(){vec3 n=normalize(vNormal);vec3 v=normalize(-vPosition);vec3 l=normalize(vec3(-.6,.9,1.4));vec3 l2=normalize(vec3(1.2,-.1,.4));vec3 ref=reflect(-v,n);float diff=max(dot(n,l),0.0);float spec=pow(max(dot(n,normalize(l+v)),0.0),55.0);float spec2=pow(max(dot(n,normalize(l2+v)),0.0),80.0);float band=pow(abs(ref.y),3.0);float fres=pow(1.0-max(dot(n,v),0.0),3.0);vec3 env=mix(vec3(.08,.12,.19),vec3(.86,.94,1.0),smoothstep(-.3,.7,ref.y));vec3 c=uColor*(.28+diff*.35)+env*.35+vec3(.8,.9,1.0)*(spec*.85+spec2*.5)+vec3(.5,.65,.82)*fres*.25+vec3(.35)*band*.2;c=mix(c,uColor*(.9+diff*.3)+spec*.3,uGlow);gl_FragColor=vec4(c,1.0);}`);
      program=gl.createProgram();gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);gl.deleteShader(vs);gl.deleteShader(fs);
      if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error('Program unavailable');
      gl.useProgram(program);
      const pos=gl.getAttribLocation(program,'aPosition'),normal=gl.getAttribLocation(program,'aNormal');
      const uniforms=Object.fromEntries(['uModel','uProjection','uColor','uGlow'].map(k=>[k,gl.getUniformLocation(program,k)]));
      const mesh=(geometry,color,glow=0)=>{
        const p=gl.createBuffer(),n=gl.createBuffer();buffers.push(p,n);
        gl.bindBuffer(gl.ARRAY_BUFFER,p);gl.bufferData(gl.ARRAY_BUFFER,geometry.positions,gl.STATIC_DRAW);
        gl.bindBuffer(gl.ARRAY_BUFFER,n);gl.bufferData(gl.ARRAY_BUFFER,geometry.normals,gl.STATIC_DRAW);
        return {p,n,count:geometry.positions.length/3,color,glow};
      };
      const silver=[.54,.6,.7],edge=[.26,.33,.43],lime=[.66,.93,.25];
      const meshes=[mesh(cylinder(0,2.65,.105),silver)];
      for(const sign of [-1,1]) {
        meshes.push(mesh(cylinder(sign*.93,.23,.73),silver),mesh(cylinder(sign*1.16,.22,.64),edge),mesh(cylinder(sign*1.36,.16,.5),silver));
        meshes.push(mesh(cylinder(sign*.99,.035,.738),lime,1));
        meshes.push(mesh(cylinder(sign*1.53,.2,.17),silver));
      }
      for(let i=-6;i<=6;i++)meshes.push(mesh(cylinder(i*.072,.012,.109),edge));
      gl.enable(gl.DEPTH_TEST);gl.clearColor(0,0,0,0);
      holder.appendChild(canvas);holder.dataset.renderer='webgl';
      let frame=0,last=0,visible=true,dead=false,targetX=0,targetY=0,currentX=0,currentY=0;
      function draw(t=0) {
        if(dead)return;
        if(!canvas.isConnected)return destroy();
        frame=0;
        if(document.hidden||!visible)return;
        if(!reduced.matches&&t-last<32){frame=requestAnimationFrame(draw);return;}last=t;
        const rect=holder.getBoundingClientRect(),scale=Math.min(devicePixelRatio||1,1.75);
        const w=Math.max(1,Math.round(rect.width*scale)),h=Math.max(1,Math.round(rect.height*scale));
        if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
        gl.viewport(0,0,w,h);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(program);
        currentX+=(targetX-currentX)*.06;currentY+=(targetY-currentY)*.06;
        const drift=reduced.matches?0:Math.sin(t*.00035)*.1;
        const model=rotation(.2+currentY,-.45+currentX+drift,-.48);
        model[13]=reduced.matches?0:Math.sin(t*.0007)*.055;model[14]=-6.6;
        gl.uniformMatrix4fv(uniforms.uProjection,false,perspective(w/h));gl.uniformMatrix4fv(uniforms.uModel,false,model);
        for(const m of meshes){gl.bindBuffer(gl.ARRAY_BUFFER,m.p);gl.enableVertexAttribArray(pos);gl.vertexAttribPointer(pos,3,gl.FLOAT,false,0,0);gl.bindBuffer(gl.ARRAY_BUFFER,m.n);gl.enableVertexAttribArray(normal);gl.vertexAttribPointer(normal,3,gl.FLOAT,false,0,0);gl.uniform3fv(uniforms.uColor,m.color);gl.uniform1f(uniforms.uGlow,m.glow);gl.drawArrays(gl.TRIANGLES,0,m.count);}
        canvas.dataset.drawn='true';if(!reduced.matches)frame=requestAnimationFrame(draw);
      }
      const request=()=>{if(!frame&&!dead)frame=requestAnimationFrame(draw);};
      const pointer=event=>{if(reduced.matches||event.pointerType==='touch')return;const r=holder.getBoundingClientRect();targetX=((event.clientX-r.left)/r.width-.5)*.7;targetY=((event.clientY-r.top)/r.height-.5)*.35;request();};
      const parent=holder.closest('.hero,.login-story')||holder;
      parent.addEventListener('pointermove',pointer,{passive:true});
      const reset=()=>{targetX=0;targetY=0;};parent.addEventListener('pointerleave',reset,{passive:true});
      const visibility=()=>{if(!document.hidden)request();};document.addEventListener('visibilitychange',visibility);
      const resized=new ResizeObserver(request);resized.observe(holder);
      const observer=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;if(visible)request();});observer.observe(holder);
      reduced.addEventListener('change',request);
      const lost=event=>{event.preventDefault();holder.dataset.renderer='svg';destroy();};canvas.addEventListener('webglcontextlost',lost);
      function destroy(){if(dead)return;dead=true;cancelAnimationFrame(frame);resized.disconnect();observer.disconnect();document.removeEventListener('visibilitychange',visibility);reduced.removeEventListener('change',request);parent.removeEventListener('pointermove',pointer);parent.removeEventListener('pointerleave',reset);canvas.removeEventListener('webglcontextlost',lost);buffers.forEach(b=>gl.deleteBuffer(b));gl.deleteProgram(program);gl.getExtension('WEBGL_lose_context')?.loseContext();canvas.remove();}
      request();return {destroy};
    } catch { buffers.forEach(b=>gl.deleteBuffer(b));if(program)gl.deleteProgram(program);holder.dataset.renderer='svg';canvas.remove();return null; }
  }
  function mount() {
    for(const [holder,scene] of scenes)if(!holder.isConnected){scene.destroy();scenes.delete(holder);}
    document.querySelectorAll('[data-scene-3d]:not([data-renderer])').forEach(holder=>{const scene=create(holder);if(scene)scenes.set(holder,scene);});
  }
  document.addEventListener('DOMContentLoaded',()=>{let pending=false;new MutationObserver(()=>{if(!pending){pending=true;requestAnimationFrame(()=>{pending=false;mount();});}}).observe(document.getElementById('app'),{childList:true,subtree:true});mount();});
})();
