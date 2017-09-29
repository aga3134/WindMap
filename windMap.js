var g_Map;
var g_Field;
var g_CurField;
var g_DrawField = false;
var g_Particle;
const MAX_PARTICLE = 2000;
const MAX_AGE = 200;
const POS_LEN = 5;
const STEP_LEN = 10;
const LINE_WIDTH = 1;

var g_FieldColor = d3.scale.linear()
	.domain([0,2,4,6,8,10,12,14,16,18,20,24,27,29])
    .range([d3.rgb(37,74,25), d3.rgb(0,150,254),
      	d3.rgb(18,196,200), d3.rgb(18,211,73),
      	d3.rgb(0,240,0), d3.rgb(127,237,0),
      	d3.rgb(254,199,0), d3.rgb(237,124,14),
      	d3.rgb(200,37,39), d3.rgb(217,0,100),
      	d3.rgb(202,25,186), d3.rgb(86,54,222),
      	d3.rgb(42,132,222), d3.rgb(64,199,222)]);

var g_ParticleColor = d3.scale.linear()
		.domain([0,POS_LEN])
		.range([d3.rgb(255,255,255),d3.rgb(0,0,0)]);

function PadLeft(val, totalLen, ch){
	var  len = (totalLen - String(val).length)+1;
	return len > 0? new Array(len).join(ch || '0')+val : val;
}

//==================field======================
function LoadFieldData(){
	g_Field = {};

	dataUrl = [	"2017092418",
				"2017092500",
				"2017092506",
				"2017092512",
				"2017092518",
				"2017092600"];

	function GenField(data, fieldID){
		var uData = data[0];
		var vData = data[1];
		field = {};
		field.header = Object.assign({}, uData.header);

		if(field.header.la1 > field.header.la2){
			field.header.la1 = uData.header.la2;
			field.header.la2 = uData.header.la1;
		}
		if(field.header.lo1 > field.header.lo2){
			field.header.lo1 = uData.header.lo2;
			field.header.lo2 = uData.header.lo1;
		}

		var la1 = field.header.la1;
		var lo1 = field.header.lo1;
		field.data = {};
		for(var i=0;i<field.header.nx;i++){
			field.data[i+lo1] = {};
		}
		for(var j=0;j<field.header.ny;j++){
			for(var i=0;i<field.header.nx;i++){
				var index = j*field.header.nx+i;
				var u = uData.data[index];	//speed*cosTheta
				var v = vData.data[index];	//speed*sinTheta
				var value = {u: u, v: v, i:i, j:j};
				value.mag = Math.sqrt(value.u*value.u+value.v*value.v);
				field.data[i+lo1][j+la1] = value;
			}
		}
		g_Field[fieldID] = field;
	}

	function LoadDataRec(urlArr, i){
		if(i >= dataUrl.length){
			g_CurField = Object.assign({}, g_Field[0]);
			DrawWindField();
			InitParticle();
			setInterval(function(){
				UpdateParticle();
				DrawParticle();
			}, 30);
			return;
		}
		var url = "/data/"+urlArr[i]+"_UV_SFC.json";
		$.get(url, function(data){
			if(!data) return;
			GenField(data, i);
			LoadDataRec(urlArr, i+1);
		});
	}

	LoadDataRec(dataUrl, 0);
}

function InterpolateField(id1, id2, alpha){
	var field1 = g_Field[id1];
	var field2 = g_Field[id2];
	var la1 = field1.header.la1;
	var lo1 = field1.header.lo1;
	for(var j=0;j<field1.header.ny;j++){
		for(var i=0;i<field1.header.nx;i++){
			var index = j*field1.header.nx+i;
			d1 = field1.data[i+lo1][j+la1];
			d2 = field2.data[i+lo1][j+la1];
			var value = {u: d1.u*(1-alpha)+d2.u*alpha, v: d1.v*(1-alpha)+d2.v*alpha, i:i, j:j};
			value.mag = Math.sqrt(value.u*value.u+value.v*value.v);
			value.theta = Math.tan2(value.v, value.u);
			g_CurField.data[i+lo1][j+la1] = value;
		}
	}
}

function GetField(lat,lng){
	if(!g_CurField) return null;
	var lat1 = parseInt(lat);
	var lat2 = lat1+1;
	var lng1 = parseInt(lng);
	var lng2 = lng1+1;

	if(lat1 < g_CurField.header.la1 || lat1 > g_CurField.header.la2) return null;
	if(lat2 < g_CurField.header.la1 || lat2 > g_CurField.header.la2) return null;
	if(lng1 < g_CurField.header.lo1 || lng1 > g_CurField.header.lo2) return null;
	if(lng2 < g_CurField.header.lo1 || lng2 > g_CurField.header.lo2) return null;
	var v0 = g_CurField.data[lng1][lat1];
	var v1 = g_CurField.data[lng1][lat2];
	var v2 = g_CurField.data[lng2][lat2];
	var v3 = g_CurField.data[lng2][lat1];
	var alpha = 1-(lat-lat1);
	var beta = 1-(lng-lng1);
	var w0 = {};
	w0.u = v0.u*alpha+v1.u*(1-alpha);
	w0.v = v0.v*alpha+v1.v*(1-alpha);
	var w1 = {};
	w1.u = v2.u*alpha+v3.u*(1-alpha);
	w1.v = v2.v*alpha+v3.v*(1-alpha);
	var v = {};
	v.u = w0.u*beta+w1.u*(1-beta);
	v.v = w0.v*beta+w1.v*(1-beta);
	v.mag = Math.sqrt(v.u*v.u+v.v*v.v);
	return v;
}

function DrawWindField(){
	if(!g_Map) return;

	var svgField = d3.select("#windField");
	svgField.selectAll("*").remove();

	var canvas = $("#fieldCanvas");
	var w = canvas.width();
	var h = canvas.height();
	var ctx = canvas[0].getContext("2d");
	ctx.clearRect(0, 0, w, h);

	if(!g_DrawField) return;
	
	var proj = g_Map.getProjection();
	var bound = g_Map.getBounds();
	if(!bound) return;
	ne = bound.getNorthEast();
	sw = bound.getSouthWest();
	var tr = proj.fromLatLngToPoint(ne);
	var bl = proj.fromLatLngToPoint(sw);
	var scale = Math.pow(2, g_Map.getZoom());

	var windScale = 0.1;

	if(!g_CurField) return;

	var la1 = g_CurField.header.la1;
	var lo1 = g_CurField.header.lo1;

	for(var j=0;j<g_CurField.header.ny;j++){
		for(var i=0;i<g_CurField.header.nx;i++){
			var index = j*g_CurField.header.nx+i;
			var wind = g_CurField.data[i+lo1][j+la1];
			var lat = g_CurField.header.la1+g_CurField.header.dy*j;
			var lng = g_CurField.header.lo1+g_CurField.header.dx*i;
			var lat2 = lat+wind.v*windScale;
			var lng2 = lng+wind.u*windScale;
			if(lng2 >= 180) continue;	//超過投影平面邊界
			var point = new google.maps.LatLng(lat,lng);
			var point2 = new google.maps.LatLng(lat2, lng2);
    		var pt = proj.fromLatLngToPoint(point);
    		var pt2 = proj.fromLatLngToPoint(point2);
    		var x = (pt.x-bl.x)*scale;
    		var y = (pt.y-tr.y)*scale;
    		var x2 = (pt2.x-bl.x)*scale;
    		var y2 = (pt2.y-tr.y)*scale;

    		ctx.strokeStyle = g_FieldColor(wind.mag);
			ctx.lineWidth = 2;
			ctx.beginPath();
			ctx.moveTo(x,y);
			ctx.lineTo(x2,y2);
			ctx.stroke();
		}
	}

	/*
	//draw by svg (slow)
	for(var j=0;j<g_CurField.header.ny;j++){
		for(var i=0;i<g_CurField.header.nx;i++){
			var index = j*g_CurField.header.nx+i;
			var wind = g_CurField.data[i+lo1][j+la1];
			var lat = g_CurField.header.la1+g_CurField.header.dy*j;
			var lng = g_CurField.header.lo1+g_CurField.header.dx*i;
			var lat2 = lat+wind.v*windScale;
			var lng2 = lng+wind.u*windScale;
			if(lng2 >= 180) continue;	//超過投影平面邊界
			var point = new google.maps.LatLng(lat,lng);
			var point2 = new google.maps.LatLng(lat2, lng2);
    		var pt = proj.fromLatLngToPoint(point);
    		var pt2 = proj.fromLatLngToPoint(point2);
    		var x = (pt.x-bl.x)*scale;
    		var y = (pt.y-tr.y)*scale;
    		var x2 = (pt2.x-bl.x)*scale;
    		var y2 = (pt2.y-tr.y)*scale;

    		svgField.append("line").attr("x1",x).attr("x2",x2)
    			.attr("y1",y).attr("y2",y2).attr("stroke",g_FieldColor(wind.mag));
		}
	}*/
}

//======================particle===========================
function CreateParticle(bound){
	var latRange = bound.maxLat-bound.minLat;
	var lngRange = bound.maxLng-bound.minLng;
	var particle = {};
	particle.age = Math.random()*MAX_AGE;
	particle.mag = 0;
	particle.vel = {u:0,v:0};
	particle.pos = [];
	var pos = {lat: Math.random()*latRange+bound.minLat, lng: Math.random()*lngRange+bound.minLng};
	for(var i=0;i<POS_LEN;i++){
		particle.pos.push(pos);
	}
	return particle;
}

function GetBound(){
	if(!g_CurField) return null;
	var bound = {};
	bound.minLat = g_CurField.header.la1;
	bound.maxLat = g_CurField.header.la2;
	bound.minLng = g_CurField.header.lo1;
	bound.maxLng = g_CurField.header.lo2;
	var mapBound = g_Map.getBounds();
	if(mapBound){
		ne = mapBound.getNorthEast();
		sw = mapBound.getSouthWest();
		if(ne.lng() > sw.lng()){	//沒跨換日線
			if(sw.lat() > bound.minLat) bound.minLat = sw.lat();
			if(ne.lat() < bound.maxLat) bound.maxLat = ne.lat();
			if(sw.lng() > bound.minLng) bound.minLng = sw.lng();
			if(ne.lng() < bound.maxLng) bound.maxLng = ne.lng();
		}
	}
	return bound;
}

function InitParticle(){
	g_Particle = [];
	var bound = GetBound();
	if(!bound) return;
	
	for(var i=0;i<MAX_PARTICLE;i++){
		var particle = CreateParticle(bound);
		g_Particle.push(particle);
	}
}

function UpdateParticle(){
	var bound = GetBound();
	if(!bound) return;
	var scale = Math.pow(2, g_Map.getZoom());
	var windScale = 0.3/scale;
	var mu = 0.95;

	for(var i=0;i<MAX_PARTICLE;i++){
		var p = g_Particle[i];
		var pos = p.pos[0];
		var wind = GetField(pos.lat, pos.lng);

		if(!wind){	//ouside field
			g_Particle[i] = CreateParticle(bound);
			continue;
		}
		if(parseInt(p.age) % STEP_LEN == 0){
			for(var j=POS_LEN-1;j>0;j--){
				p.pos[j] = p.pos[j-1];
			}
		}
		var vel = {u: p.vel.u*mu+wind.u*(1-mu), v: p.vel.v*mu+wind.v*(1-mu)};
		var newPos = {lat: pos.lat+vel.v*windScale, lng: pos.lng+vel.u*windScale};
		p.mag = wind.mag;
		p.vel = wind;
		p.pos[0] = newPos;
		p.age++;
		if(p.age >= MAX_AGE){	//delete old particle & create new
			g_Particle[i] = CreateParticle(bound);
		}
	}
}

function DrawParticle(){
	if(!g_Map) return;

	var proj = g_Map.getProjection();
	var bound = g_Map.getBounds();
	if(!bound) return;
	ne = bound.getNorthEast();
	sw = bound.getSouthWest();
	var tr = proj.fromLatLngToPoint(ne);
	var bl = proj.fromLatLngToPoint(sw);
	var scale = Math.pow(2, g_Map.getZoom());

	var canvas = $("#windCanvas");
	var w = canvas.width();
	var h = canvas.height();
	var ctx = canvas[0].getContext("2d");
	ctx.clearRect(0, 0, w, h);


	for(var i=0;i<MAX_PARTICLE;i++){
		var p = g_Particle[i];

		var pathArr = [];
		var skip = false;
		for(var j=0;j<POS_LEN;j++){
			var point = new google.maps.LatLng(p.pos[j].lat,p.pos[j].lng);
			var pt = proj.fromLatLngToPoint(point);
			if(p.pos[j].lng >= 180){	//超過投影平面邊界
				skip = true;
				break;
			}
			var x = (pt.x-bl.x)*scale;
			var y = (pt.y-tr.y)*scale;
			pathArr.push({x:x, y:y});
		}
		if(skip) continue;
		var firstPt = pathArr[0];
		var lastPt = pathArr[POS_LEN-1];
		var gradient = ctx.createLinearGradient(firstPt.x,firstPt.y,lastPt.x,lastPt.y);
		//var opacity = Math.min(p.mag*0.1, 1);
		var opacity = 1-p.age/MAX_AGE;
		gradient.addColorStop("0","rgba(255,255,255,"+opacity+")");
		gradient.addColorStop("1","rgba(255,255,255,0)");

		ctx.strokeStyle = gradient;
		ctx.lineWidth = LINE_WIDTH;
		ctx.beginPath();
		ctx.moveTo(firstPt.x,firstPt.y);
		for(var j=1;j<pathArr.length;j++){
			ctx.lineTo(pathArr[j].x,pathArr[j].y);
		}
		ctx.stroke();
			
	}

	/*
	//draw particle in svg (slow)
	var svgParticle = d3.select("#windParticle");
	svgParticle.selectAll("*").remove();
	for(var i=0;i<MAX_PARTICLE;i++){
		var p = g_Particle[i];

		var pathArr = [];
		var skip = false;
		for(var j=0;j<POS_LEN;j++){
			var point = new google.maps.LatLng(p.pos[j].lat,p.pos[j].lng);
			var pt = proj.fromLatLngToPoint(point);
			if(p.pos[j].lng >= 180){	//超過投影平面邊界
				skip = true;
				break;
			}
			var x = (pt.x-bl.x)*scale;
			var y = (pt.y-tr.y)*scale;
			pathArr.push({x:x, y:y});
		}
		if(skip) continue;
		var curve = d3.svg.line()
                   .x(function(d) { return d.x; })
                   .y(function(d) { return d.y; })
                   .interpolate("bundle");

		svgParticle.append("path")
			.attr("d",curve(pathArr))
			.attr("fill","None")
			.attr("stroke","url(#whiteGradient)");
			
	}*/
}

//=========================================================
function ResizeCanvas(){
	var canvas = $("#windCanvas");
	var w = canvas.width();
	var h = canvas.height();
	canvas[0].width = w;
	canvas[0].height = h;

	canvas = $("#fieldCanvas");
	w = canvas.width();
	h = canvas.height();
	canvas[0].width = w;
	canvas[0].height = h;
}

function InitMap() {
	var taiwan = new google.maps.LatLng(23.682094,120.7764642);

	g_Map = new google.maps.Map(document.getElementById('map'), {
		center: taiwan,
		zoom: 5,
		scaleControl: true,
		mapTypeId: 'hybrid'
	});

	google.maps.event.addListener(g_Map, 'idle', function() {
		//var windField =  d3.select("#windField");
		//windField.selectAll("*").remove();
		DrawWindField();
    });

    g_Map.addListener('dragstart', function() {
		var windField =  d3.select("#windField");
		windField.selectAll("*").remove();
	});

    g_Map.addListener('dragend', function() {
		//DrawWindField();
	});

	g_Map.addListener('zoom_changed', function() {
		if (g_Map.getZoom() < 4) g_Map.setZoom(4);
		//DrawWindField();
	});

	$("#toggleField").change(function(){
		g_DrawField = $("#toggleField").prop("checked");
		DrawWindField();
	});
	
	ResizeCanvas();
	LoadFieldData();
}

google.maps.event.addDomListener(window, 'load', InitMap);