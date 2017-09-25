var g_Map;

function UpdateWindGrid(){
	var svg =  d3.select("#windMap");
	svg.selectAll("*").remove();

	var proj = g_Map.getProjection();
	var bound = g_Map.getBounds();
	ne = bound.getNorthEast();
	sw = bound.getSouthWest();
	var tr = proj.fromLatLngToPoint(ne);
	var bl = proj.fromLatLngToPoint(sw);
	var scale = Math.pow(2, g_Map.getZoom());
    for(var lat=Math.floor(sw.lat());lat<=Math.ceil(ne.lat());lat+=1){
    	for(var lng=Math.floor(sw.lng());lng<=Math.ceil(ne.lng());lng+=1){
    		var point = new google.maps.LatLng(lat,lng);
    		var pt = proj.fromLatLngToPoint(point);
    		var x = (pt.x - bl.x) * scale;
    		var y = (pt.y - tr.y) * scale;
    		svg.append("circle").attr("cx",x).attr("cy",y).attr("r",2).attr("fill","red");
    	}
    }
}

function InitMap() {
	var taiwan = new google.maps.LatLng(23.682094,120.7764642);

	g_Map = new google.maps.Map(document.getElementById('map'), {
		center: taiwan,
		zoom: 7,
		scaleControl: true,
		mapTypeId: 'satellite'
	});

	google.maps.event.addListener(g_Map, 'bounds_changed', function() {
		UpdateWindGrid();
    });
	
}

google.maps.event.addDomListener(window, 'load', InitMap);