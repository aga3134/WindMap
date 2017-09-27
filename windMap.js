var g_Map;
var g_Field;
var g_CurField;

g_FieldColor = d3.scale.linear()
	.domain([0,2,4,6,8,10,12,14,16,18,20,24,27,29])
    .range([d3.rgb(37,74,25), d3.rgb(0,150,254),
      	d3.rgb(18,196,200), d3.rgb(18,211,73),
      	d3.rgb(0,240,0), d3.rgb(127,237,0),
      	d3.rgb(254,199,0), d3.rgb(237,124,14),
      	d3.rgb(200,37,39), d3.rgb(217,0,100),
      	d3.rgb(202,25,186), d3.rgb(86,54,222),
      	d3.rgb(42,132,222), d3.rgb(64,199,222)]);

function PadLeft(val, totalLen, ch){
	var  len = (totalLen - String(val).length)+1;
	return len > 0? new Array(len).join(ch || '0')+val : val;
}

function LoadWindData(){
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
				var value = {u: u, v: v, i:i, j:j};
				value.mag = Math.sqrt(value.u*value.u+value.v*value.v);
				field.data.push(value);
			}
		}
		g_Field[fieldID] = field;
	}

	function LoadDataRec(urlArr, i){
		if(i >= dataUrl.length){
			g_CurField = Object.assign({}, g_Field["0"]);
			return UpdateWindGrid();
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
	for(var j=0;j<field1.header.ny;j++){
		for(var i=0;i<field1.header.nx;i++){
			var index = j*field1.header.nx+i;
			d1 = field1.data[index];
			d2 = field2.data[index];
			var value = {u: d1.u*(1-alpha)+d2.u*alpha, v: d1.v*(1-alpha)+d2.v*alpha, i:i, j:j};
			value.mag = Math.sqrt(value.u*value.u+value.v*value.v);
			g_CurField.data[index] = value;
		}
	}
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
	var windScale = 0.1;

	if(!g_CurField) return;

	for(var j=0;j<g_CurField.header.ny;j++){
		for(var i=0;i<g_CurField.header.nx;i++){
			var index = j*g_CurField.header.nx+i;
			var wind = g_CurField.data[index];
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

    		svg.append("circle").attr("cx",x).attr("cy",y).attr("r",2).attr("fill","red");
    		svg.append("line").attr("x1",x).attr("x2",x2)
    			.attr("y1",y).attr("y2",y2).attr("stroke",g_FieldColor(wind.mag));
		}
	}
}

function InitMap() {
	var taiwan = new google.maps.LatLng(23.682094,120.7764642);

	g_Map = new google.maps.Map(document.getElementById('map'), {
		center: taiwan,
		zoom: 5,
		scaleControl: true,
		mapTypeId: 'hybrid'
	});

	google.maps.event.addListener(g_Map, 'bounds_changed', function() {
		var svg =  d3.select("#windMap");
		svg.selectAll("*").remove();
		//UpdateWindGrid();
    });

    g_Map.addListener('dragend', function() {
		UpdateWindGrid();
	});

	g_Map.addListener('zoom_changed', function() {
		UpdateWindGrid();
	});
	
	LoadWindData();
}

google.maps.event.addDomListener(window, 'load', InitMap);