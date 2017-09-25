var g_Map;
var g_Field;

function PadLeft(val, totalLen, ch){
	var  len = (totalLen - String(val).length)+1;
	return len > 0? new Array(len).join(ch || '0')+val : val;
}

function LoadWindData(){
	g_Field = {};

	dataUrl = ["/data/2017092418_UV_SFC.json",
				"/data/2017092500_UV_SFC.json",
				"/data/2017092506_UV_SFC.json",
				"/data/2017092512_UV_SFC.json",
				"/data/2017092518_UV_SFC.json",
				"/data/2017092600_UV_SFC.json"];

	function GenField(data, fieldID){
		var uData = data[0];
		var vData = data[1];
		field = {};
		field.header = uData.header;
		if(field.header.la1 > field.header.la2){
			field.header.la1 = uData.header.la2;
			field.header.la2 = uData.header.la1;
		}
		if(field.header.lo1 > field.header.lo2){
			field.header.lo1 = uData.header.lo2;
			field.header.lo2 = uData.header.lo1;
		}

		field.data = [];
		for(var j=0;j<field.header.ny;j++){
			for(var i=0;i<field.header.nx;i++){
				var index = j*field.header.nx+i;
				var u = uData.data[index];	//speed*cosTheta
				var v = vData.data[index];	//speed*sinTheta
				var value = {u: u, v: v};
				value.mag = Math.sqrt(value.u*value.u+value.v*value.v);
				field.data.push(value);
			}
		}
		g_Field[fieldID] = field;
	}

	function LoadDataRec(urlArr, i){
		if(i >= dataUrl.length) return UpdateWindGrid();
		var url = urlArr[i];
		$.get(url, function(data){
			if(!data) return;
			GenField(data, i);
			LoadDataRec(urlArr, i+1);
		});
	}

	LoadDataRec(dataUrl, 0);
}

function UpdateWindGrid(){
	if(!g_Map) return;
	var svg =  d3.select("#windMap");
	svg.selectAll("*").remove();

	var proj = g_Map.getProjection();
	var bound = g_Map.getBounds();
	if(!bound) return;
	ne = bound.getNorthEast();
	sw = bound.getSouthWest();
	var tr = proj.fromLatLngToPoint(ne);
	var bl = proj.fromLatLngToPoint(sw);
	var scale = Math.pow(2, g_Map.getZoom());

	color = d3.scale.linear().domain([0,2,4,6,8,10,12,14,16,18])
      .range([d3.rgb(37,74,25), d3.rgb(0,150,254),
      	d3.rgb(18,196,200), d3.rgb(18,211,73),
      	d3.rgb(0,240,0), d3.rgb(127,237,0),
      	d3.rgb(254,199,0), d3.rgb(237,124,14),
      	d3.rgb(200,37,39), d3.rgb(217,0,100)]);

	var field = g_Field["1"];
	if(!field) return;
	for(var j=0;j<field.header.ny;j++){
		for(var i=0;i<field.header.nx;i++){
			var index = j*field.header.nx+i;
			var wind = field.data[index];
			var windScale = 0.1;
			var lat = field.header.la1+field.header.dy*j;
			var lng = field.header.lo1+field.header.dx*i;
			var lat2 = lat+wind.v*windScale;
			var lng2 = lng+wind.u*windScale;
			if(lng2 >= 180) continue;	//will produce projection error
			var point = new google.maps.LatLng(lat,lng);
			var point2 = new google.maps.LatLng(lat2, lng2);
    		var pt = proj.fromLatLngToPoint(point);
    		var pt2 = proj.fromLatLngToPoint(point2);
    		var x = (pt.x - bl.x) * scale;
    		var y = (pt.y - tr.y) * scale;
    		var x2 = (pt2.x-bl.x)*scale;
    		var y2 = (pt2.y-tr.y)*scale;

    		svg.append("circle").attr("cx",x).attr("cy",y).attr("r",2).attr("fill","red");
    		svg.append("line").attr("x1",x).attr("x2",x2)
    			.attr("y1",y).attr("y2",y2).attr("stroke",color(wind.mag));
		}
	}

    /*for(var lat=Math.floor(sw.lat());lat<=Math.ceil(ne.lat());lat+=1){
    	for(var lng=Math.floor(sw.lng());lng<=Math.ceil(ne.lng());lng+=1){
    		var point = new google.maps.LatLng(lat,lng);
    		var pt = proj.fromLatLngToPoint(point);
    		var x = (pt.x - bl.x) * scale;
    		var y = (pt.y - tr.y) * scale;
    		svg.append("circle").attr("cx",x).attr("cy",y).attr("r",2).attr("fill","red");
    	}
    }*/
}

function InitMap() {
	var taiwan = new google.maps.LatLng(23.682094,120.7764642);

	g_Map = new google.maps.Map(document.getElementById('map'), {
		center: taiwan,
		zoom: 5,
		scaleControl: true,
		mapTypeId: 'satellite'
	});

	google.maps.event.addListener(g_Map, 'bounds_changed', function() {
		UpdateWindGrid();
    });
	
	LoadWindData();
}

google.maps.event.addDomListener(window, 'load', InitMap);