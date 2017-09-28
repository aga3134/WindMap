var g_TimerID = null;
var g_CurYear = "2017";
var g_CurDate = "09/25";
var g_CurTime;

function UpdateTime(val){
	var hour = PadLeft(parseInt(val/6),2,"0");
	var minute = PadLeft((val%6)*10,2,"0");
	g_CurTime = hour+":"+minute;
	$("#timeInfo").text(g_CurYear+"/"+g_CurDate+" "+g_CurTime);
	//2:00 -> index1, 8:00 -> index2, 14:00 -> index3, 20:00 -> index4
	var id1 = parseInt((val+24)/36);	//val轉index->加4小時再除以6小時 
	var id2 = id1+1;
	var alpha = (val-(id1*36-24))/36;	//index轉回分鐘相減，再算佔6小時的比例
	InterpolateField(id1, id2, alpha);
	DrawWindField();
}

function Play(){
	var bt = $("#playBt");
	bt.text("停止");
	bt.attr("onclick","Stop();");
	if(g_TimerID) return;
	g_TimerID = setInterval(function(){
		var timeBar = $("#timeBar");
		var val = parseInt(timeBar.val());
		var maxVal = timeBar.attr("max");
		if(val >= maxVal) Stop();
		else{
			nextVal = val+1;	//1單位代表10分鐘
			timeBar.val(nextVal);
			UpdateTime(nextVal);
		}
	}, 1000);
}

function Stop(){
	var bt = $("#playBt");
	bt.text("播放");
	bt.attr("onclick","Play();");
	clearInterval(g_TimerID);
	g_TimerID = null;
}

window.addEventListener("resize", ResizeCanvas);

window.addEventListener('load', function() {
	$("#timeBar").change(function(){
		var val = parseInt($("#timeBar").val());
		UpdateTime(val);
	});

});
