/***************************************************
  Netatmo2 Plugin For SARAH
  Author: Alban Vidal-Naquet (albanvn@gmail.com)
  Date: 29/09/2013
  File: netatmo2.js
 ***************************************************/

//////////////////////////////////////////////////////
// TODO LIST:
// -Manage a group of device: "Interieur": "1-3", "Exterieur": "0", "Other": "4-8", "All": "0-8"
// -Add date in FillInfo for each device and last data getted
//////////////////////////////////////////////////////

////////////////
// Constants
// Netatmo URL
const gs_token_url = 'http://api.netatmo.net/oauth2/token';
const gs_device_url = 'http://api.netatmo.net/api/getuser?access_token=';
const gs_device_list_url = 'http://api.netatmo.net/api/devicelist?access_token=';
const gs_measure_url = 'http://api.netatmo.net/api/getmeasure?access_token=';
const gs_netatmoxmlfile="netatmo2.xml";
const gs_skip_empty=1;
const gs_co2histosize=3;
const gs_maxco2avg=3;
const gs_timercron=60*5;
// in mV
const gs_batteryhigh=6000;
const gs_batterylow=3500;
// in ppm
const gs_maxco2upvariation=200;
const gs_minco2fine=500;
const gs_minco2downvariation=-100;

////////////////
// Variables
// Netatmo token & connection data
var g_token = "";
var g_expiresin = "";
var g_refresh_token = "";
// Array
var g_values=new Array();
var g_types=new Array();
var g_lvlbattery=new Array();
var g_batt=new Array()
var g_names=new Array();
var g_co2histo=new Array();
var g_co2stat=new Array();
// Simple var
// For debug purpose, bits setted:
// 1: only http in and out
// 2: co2 step 1
// 4: co2 step 2
// 8: show devices list
var g_debug=6;
var g_connexion=false;
var g_mod=0;
var g_req=0;
var g_lastalertdate=0;
var g_flag_co2dec=0;
var g_flag_co2stable=0;
var g_timeouttoken=0;
var g_first=1;
var g_lasttime=0;
// Sarah advice and message
const gs_msg_okletshavealook="Je me renseigne";
const gs_msg_advice_allok="Rien à signaler de particulier";
const gs_msg_advice_synhabitat="Voici le bilan de l'habitat:";
const gs_msg_advice_start="Dans:"
const gs_msg_nodata_msg=".Aucune donnée pour ";
const gs_msg_errsettings="Les paramètre du pleug ine Nette atmo sont incomplet, veuillez les renseigner";
const gs_msg_errornetatmosite="Impossible de joindre Netatmo";
const gs_msg_allisfine="Rien à signaler de particulier.";
const gs_msg_advice_co2max="Le niveau maximum de CO2 à été dépassé, il faut aérer.";
const gs_msg_co2stabilize=", la qualité de l'air est maintenant stabilisé à ";
const gs_msg_co2quickup=", attention le niveau de CO2 augmente rapidement.";
const gs_msg_co2nowfine="Le niveau de CO2 est maintenant redevenu normal.";

// Array for advice
var g_air=new Array(5);
var g_advice_air=new Array
					(
					    "la qualité de l'air est excellente,.",
						"la qualité de l'air est bonne,.",
						"la qualité de l'air est modérée, si vous avez le temps, pensez à aérer,.",
						"la qualité de l'air est médiocre, il faut aérer rapidement,.",
						"la qualité de l'air est nocive, aérer tout de suite,."
					);
var g_temp=new Array(2);
var g_advice_temp=new Array
				(
					"la tempèrature est élevé, veillez à moins chauffer ou à aérer.",
					"la tempèrature est basse, veillez à plus chauffer."
				);
var g_exttemp=new Array(2);
var g_advice_exttemp=new Array
				(
					"la tempèrature extérieur est au dessus du seuil maximum.",
					"la tempèrature extérieur est au dessous du seuil minimum."
				);
var g_humidity=new Array(2);
var g_advice_humidity=new Array
				(
					"l'humidité est élevé, veillez à déshumidifier.",
					"l'humidité est basse, veillez à humidifier."
				);
var g_exthumidity=new Array(2);
var g_advice_exthumidity=new Array
				(
					"l'humidité extérieur est au dessus du seuil maximum.",
					"l'humidité extérieur est au dessous du seuil minimum."
				);
var g_noise=new Array(1);
var g_advice_noise=new Array
				(
					"il y a beaucoup de bruit, réduisez le."
				);
				
var g_battery=new Array(2);
var g_advice_battery=new Array
				( 
					"la batterie est presque vide, veillez à la remplacer",
					"la batterie est à moitié vide"
				);
		
var g_netatmo_unit=new Array
					(		
						"degré",
						"p.p.m.",
						"pour cent",
						"millibarres",
						"décibels"
					);

var g_netatmo_title=new Array
					(
 					   "Température",
						"C.O.2.",
						"Humidité",
						"Préssion",
						"Bruit"
					);
					

/////////////////////
// SARAH MODULE INIT FUNCTION
/////////////////////
exports.init = function (SARAH)
{
  var config=SARAH.ConfigManager.getConfig();
  config = config.modules.netatmo2;
  if (!config.email || !config.password || !config.id || !config.secret)
  {
	SARAH.speak(gs_msg_errsettings);
	return ;
  }
  var data = {};
  // To generate XML
  data.init=1;
  data.silent=1;
  if (gs_timercron>0)
    // Generate CRON measure
	setInterval(function(){getBasic(SARAH.ConfigManager.getConfig(), SARAH, 4);}, 1000*gs_timercron, 0);
  SARAH.context.Netatmo2Info=fillInfo(0, config.version, g_connexion, g_names, g_types, g_values, g_batt, g_lvlbattery, g_co2histo);
  getToken(gs_token_url, config.email, config.password, config.id, config.secret, data, config, SARAH);
  return ;
}

/////////////////////
// SARAH MODULE ACTION FUNCTION
/////////////////////
exports.action = function(data, callback, config, SARAH) 
{
  var config = config.modules.netatmo2;
  
  if (!config.email || !config.password || !config.id || !config.secret)
    return SARAH.speak(gs_msg_errsettings);
  SARAH.speak(gs_msg_okletshavealook); 
  data.silent=0;
  if (data.init==4)
    data.silent=1;
  getToken(gs_token_url, config.email, config.password, config.id, config.secret, data, config, SARAH);
  callback();
}

/////////////////////
// SARAH MODULE GETBASIC FUNCTION
/////////////////////
var getBasic = function(config, SARAH, init)
{
  var config = config.modules.netatmo2;
  var data={};
  var info={};
  
  if (!init) 
	init=2;
  data.init=init;
  data.silent=1;
  data.mode=-1;
  data.capteur=-1;
  SARAH.context.Netatmo2Info=fillInfo(0, config.version, g_connexion, g_names, g_types, g_values, g_batt, g_lvlbattery, g_co2histo);
  info=SARAH.context.Netatmo2Info;
  if (!config.email || !config.password || !config.id || !config.secret)
  {
    info.error=1;
    return info;
  }
  // Refresh for the next time the netatmo data
  getToken(gs_token_url, config.email, config.password, config.id, config.secret, data, config, SARAH);
  return info;
}

exports.getBasic=getBasic;

////////////////////////
// PRIVATE FUNCTION
////////////////////////

var getURL = function(url, data, config, mycallback, arg, SARAH)
{
    if ((g_debug&1)!=0)
	  console.log("getUrl:"+url);
	var request = require('request');
	request(
				{'uri': url}
				, function (err, response, body)
				{
					if (err || response.statusCode != 200) 
					{
					  console.log("getURL error:"+response.statusCode);
					  if (data.silent==0)
					    SARAH.speak(gs_msg_errornetatmosite);
					  return -1;
					}
					return mycallback (body, data, config, arg, SARAH);
				}
			);
	return -2;
}

var getToken = function(url, username, password, id, secret, data, config, SARAH)
{
	var form_init={
						'grant_type' 	: "password",
						'client_id' 	: id,
						'client_secret' : secret,
						'username' 	    : username,
						'password' 	    : password
					};
    var form_refresh={
						'grant_type' 	: "refresh_token",
						'client_id' 	: id,
						'client_secret' : secret,
						'refresh_token' : g_refresh_token
					};
	if (g_timeouttoken!=0 && new Date().getTime()<(g_timeouttoken-3))
	{
      var device_list_url=gs_device_list_url+g_token;
      getURL(device_list_url, data, config, parseDeviceList, 0, SARAH);
	  return 0;
    }
	else
	{
		var request = require('request');
		
		if ((g_debug&1)!=0)
		  console.log("getToken:"+url);
		if (g_timeouttoken==0)
		  form=form_init;
		else
		  form=form_refresh;
		g_connexion=false;
		request({ 
					'uri'     : url,
					'method'  : 'post',
					'headers' : { 
							   'Content-type'   : 'application/x-www-form-urlencoded;charset=UTF-8'
							   },
					'form'    : form
				}, function (err, response, body)
				{
					if (err || response.statusCode != 200) 
					{
						console.log("getToken error:"+response.statusCode);
						if (data.silent==0) 
						  SARAH.speak(gs_msg_errornetatmosite);
						return -1;
					}
					return parseToken(body, data, config, SARAH);
				});
	}
	return -2;
}

var fillInfo=function(error, version, connexion, names, types, values, batt, lvlbattery, co2histo)
{
  var info={};
  
  info.date=(new Date().getTime()/1000);
  info.error=error;
  info.version=version;
  info.connexion=connexion;
  info.names=names;
  info.types=types;
  info.values=values;
  info.battery=batt;
  info.lvlbattery=lvlbattery;
  info.co2histo=co2histo;
  return info;
}

var parseToken = function(body, data, config, SARAH)
{
	var json = JSON.parse(body);

	g_token = json.access_token;
	g_expiresin = json.expires_in;
	g_refresh_token = json.refresh_token;
    g_timeouttoken=new Date().getTime()+g_expiresin;
	g_connexion=true;
    var device_list_url=gs_device_list_url+g_token;
    getURL(device_list_url, data, config, parseDeviceList, 0, SARAH);
	return 0;
}

function initCO2Array(size)
{
	var i=0;
	g_co2histo=new Array(size);
	g_co2stat=new Array(size);
	for (i=0;i<size;i++)
	{
	  g_co2stat[i]={min:-1,max:-1,current_evol:0,last_evol:0,delta:0,alert:0,alert_date:0,txt:""};
	  g_co2stat[i].co2avg=new Array();
	  g_co2histo[i]=new Array();
	}
}

var parseDeviceList = function(body, data, config, arg, SARAH)
{
	var json = JSON.parse(body);

	if ((g_debug&1)!=0)
		console.log(body);
    g_req=0;
	// Maximize g_names and g_types to avoid pre count
	g_names=new Array(json.body.devices.length*4);
	g_types=new Array(json.body.devices.length*4);
	g_lvlbattery=new Array(json.body.devices.length*4);
	g_batt=new Array(json.body.devices.length*4);
	g_resume=new Array(json.body.devices.length*4);
	if (g_first==1)
		initCO2Array(json.body.devices.length*4);
	g_mod=0;
    config_xml="";
	// Extract devices and modules to an 1 dim array
	for (i=0;i<json.body.devices.length;i++)
	{
	  config_xml+="		<item>"+json.body.devices[i].module_name+"<tag>out.action.capteur=\""+g_mod+"\";</tag></item>\n";
	  g_names[g_mod]=json.body.devices[i].module_name;
	  g_types[g_mod]=json.body.devices[i].type;
	  g_lvlbattery[g_mod++]=-1;
	  for (j=0;j<json.body.devices[i].modules.length;j++)
	  {
	    for (k=0;k<json.body.modules.length;k++)
			if (json.body.devices[i].modules[j]==json.body.modules[k]._id)
			{
				config_xml+="		<item>"+json.body.modules[k].module_name+"<tag>out.action.capteur=\""+g_mod+"\";</tag></item>\n";
				g_names[g_mod]=json.body.modules[k].module_name;
				g_types[g_mod]=json.body.modules[k].type;
				g_lvlbattery[g_mod++]=json.body.modules[k].battery_vp;
			}
	  }
	} 
	// Create Data array (Temp, Pressure, Noise, Humidity, CO2
	g_values=new Array(g_mod);
	for (i=0;i<g_mod;i++) 
		g_values[i]=new Array(5);
	// Get Devices and modules info and save its
	count=0;
	if ((g_debug&8)!=0)
		showDevice();
	switch(data.init)
	{
	  case 2:
	  case 3:
		  // Init 2 or 3
		  //   2: Only check batteries charge
		  //   3: Give advice for batteries level
		  resetAdvice();
		  // Check Battery
		  for (i=0;i<g_mod;i++)
			  checkBattery(g_types[i],g_names[i],i);
		  if (data.init==3)
		  {
			var txt=buildBatteryAdvice();
			if (txt=="") 
				txt=gs_msg_allisfine;
			if (data.silent==0)
			  SARAH.speak(txt);
		  }
		  break;
	  case 1:
		  // Init 1:
		  //   Generate XML 
	      //   And check batteries charge
		  //
		  // Update Netatmo2.xml with netatmo settings parameters
		  var fs   = require('fs');
		  var file = __dirname + "\\" + gs_netatmoxmlfile;
		  var xml  = fs.readFileSync(file,'utf8');
		  var regexp = new RegExp('§[^§]+§','gm');
		  var xml    = xml.replace(regexp, "§ -->\n" + config_xml + "<!-- §");
		  fs.writeFileSync(__dirname+"\\"+gs_netatmoxmlfile, xml, 'utf8');
		  resetAdvice();
  		  // Check Battery
		  for (i=0;i<g_mod;i++)
			  checkBattery(g_types[i],g_names[i],i);
		  // now let's get the first measures
	  default:
	    // Init all : 0,4-9999
		//   O: do measure and advice for general purpose
		//   4: do measure and advice for cron task
	    // Get all measures
		var txt="";
		var time=Math.floor(new Date().getTime()/1000);
		if (data.init!=4)
			txt="&date_end=last";
		else
		{
			if (g_first==1)
				// Get at least gs_co2histosize data values
				txt="&date_begin="+(time-(60*5*(gs_co2histosize+1)));
			else
				txt="&date_begin="+g_lasttime;
		}
		g_lasttime=time+1;
		for (i=0;i<json.body.devices.length;i++)
		{
		  measure_url = gs_measure_url+g_token+'&device_id='+json.body.devices[i]._id+'&type=Temperature,CO2,Humidity,Pressure,Noise&scale=max'+txt;
		  getURL(measure_url, data, config, parseMeasure,count++, SARAH);
		  for (j=0;j<json.body.devices[i].modules.length;j++)
		  {
			measure_url = gs_measure_url+g_token+'&device_id='+json.body.devices[i]._id+'&module_id='+json.body.modules[j]._id+'&type=Temperature,CO2,Humidity,Pressure&scale=max'+txt;
			getURL(measure_url, data, config, parseMeasure,count++, SARAH);
		  }
		  break;
		}
		g_first=0;
	}
	return 0;
}

var parseMeasure = function(body, data, config, mod, SARAH)
{
	var json= JSON.parse(body);
    g_req++;
	if ((g_debug&1)!=0)
		console.log(mod+":"+body);
	for (l=0;l<json.body.length;l++)
		for (k=0;k<json.body[l].value.length;k++)
		{
			var co2=-1;
			switch(g_types[mod])
			{
			  // Main netatmo device
			  case "NAMain":
				g_values[mod][0]=json.body[l].value[k][0]; // Temperature
				g_values[mod][1]=json.body[l].value[k][1]; // CO2
				g_values[mod][2]=json.body[l].value[k][2]; // Humidity
				g_values[mod][3]=json.body[l].value[k][3]; // Pressure
				g_values[mod][4]=json.body[l].value[k][4]; // Noise
				co2=json.body[l].value[k][1];
				break;
			  // External netatmo device
			  case "NAModule1":
				g_values[mod][0]=json.body[l].value[k][0]; // Temperature
				g_values[mod][2]=json.body[l].value[k][2]; // Humidity
				g_values[mod][1]=-1; // ignored
				g_values[mod][3]=-1; // ignored
				g_values[mod][4]=-1; // ignored 
				break;
			  // 'Add on' netatmo device
			  case "NAModule4":
				g_values[mod][0]=json.body[l].value[k][0]; // Temperature
				g_values[mod][1]=json.body[l].value[k][1]; // CO2
				g_values[mod][2]=json.body[l].value[k][2]; // Humidity
				g_values[mod][3]=-1; // ignored
				g_values[mod][4]=-1; // ignored
				co2=json.body[l].value[k][1];
				break;
			}
			// Consolidate CO2 histo only if CRON mode set
			if (co2!=-1 && data.init==4)
			{
				// Save current co2 in co2 histo
				g_co2histo[mod].push(co2);
				if ((g_debug&2)!=0)
					console.log("Add #"+mod+" co2 value:"+co2+" arraysize:"+g_co2histo[mod].length+" co2histo.length:"+g_co2histo.length);
				// If array is full, then shift the first item
				if (g_co2histo[mod].length>gs_co2histosize)
				  g_co2histo[mod].shift();
				info=AnalyseCO2(mod, SARAH);
			}
		}
	
	// Refresh shared netatmo data...
	SARAH.context.Netatmo2Info=fillInfo(0, config.version, g_connexion, g_names, g_types, g_values, g_batt, g_lvlbattery, g_co2histo);
	var advice="";
    if (g_req==g_mod && (data.init>=4 || data.init==0 || typeof data.init==='undefined'))
	{
		 var now=new Date();
		 var advice=buildSentenceAndSpeak(data,config, SARAH);
		 if (data.init==4)
		 {
		   if (checkDateRange(config.range_t1, now)==true ||
		       checkDateRange(config.range_t2, now)==true ||
		       checkDateRange(config.range_t3, now)==true ||
		       checkDateRange(config.range_t4, now)==true ||
		       checkDateRange(config.range_t5, now)==true ||
		       checkDateRange(config.range_t6, now)==true)
		   {
		       if (advice!="" && now.getTime()>=g_lastalertdate)
		       {
				 if ((g_debug&2)!=0)
					console.log(new Date()+":"+advice);
		         SARAH.speak(advice);
		         g_lastalertdate=now.getTime()+(config.freq_alert*60*1000);
		       }
			   for (k=0;k<g_mod;k++)
			   {
					if (g_co2stat[k].alert==1 && now.getTime()>=g_co2stat[k].alert_date)
					{
						if ((g_debug&4)!=0)
							console.log(new Date()+":"+g_co2stat[mod].txt);
						SARAH.speak(g_co2stat[k].txt);
						g_co2stat[k].alert=0;
						g_co2stat[k].alert_date=now.getTime()+(config.freq_alert*60*1000);
					}
					else
						g_co2stat[k].alert=0;
			   }
		   }
		 }
    }
	return 0;
}

var deformatDate=function(string)
{
  var pos1=string.indexOf("-");
  var pos2=string.indexOf("=");
  var i={day_b:0,day_e:6,hour_b:0,min_b:0,hour_e:23,min_e:59};
  if (string.length!=13)
    return;
  if (pos2!=-1)
  {
    if (pos1!=-1 && pos1<pos2)
	{
      i.day_b=parseInt(string.substr(0,2));
	  i.day_e=parseInt(string.substr(pos1+1,2));
	}
	pos1=string.lastIndexOf("-");
	i.hour_b=parseInt(string.substr(pos2+1,2));
	i.min_b=parseInt(string.substr(pos2+3,2));
	i.hour_e=parseInt(string.substr(pos1+1,2));
	i.min_e=parseInt(string.substr(pos1+3,2));
  }
  return i;
}

var checkDateRange=function(string, date)
{
  var i;  
  
  if (string=="" || typeof string==='undefined')
    return false;
  i=deformatDate(string);
  if (i.day_b>i.day_e)
  {
    if (date.getDay()>i.day_b && date.getDay()<i.day_e)
	  return false;
  }
  else if (date.getDay()<i.day_b || date.getDay()>i.day_e)
    return false;
  if (date.getHours()<i.hour_b || date.getHours()>i.hour_e)
    return false;  
  if (date.getHours()==i.hour_b)
  {
    if (date.getMinutes()<i.minutes_b)
		return false;
  }
  if (date.getHours()==i.hour_e)
	if (date.getMinutes()>i.minutes_e)
		return false;
  return true;
}

var AnalyseCO2=function(mod, SARAH)
{
    var now=new Date();
	var sum=0;
	var dec=1;
	var inc=1;
	var last=-1;
	var last_value=0;
	
	// If no data then wait its
	if (g_co2histo[mod].length==0)
	  return g_co2stat;
	for (i=0;i<g_co2histo[mod].length;i++)
	{
	 if (g_co2histo[mod][i]<g_co2stat[mod].min || g_co2stat[mod].min==-1)
	   g_co2stat[mod].min=g_co2histo[mod][i];
	 if (g_co2histo[mod][i]>g_co2stat[mod].max || g_co2stat[mod].max==-1)
	   g_co2stat[mod].max=g_co2histo[mod][i];
	 last_value=g_co2histo[mod][i];
	 sum+=last_value;
	}
	// Do average on last CO2 value
	sum=Math.floor(sum/g_co2histo[mod].length);
	g_co2stat[mod].co2avg.push(sum);
	// If array is full then shift out first item
	if (g_co2stat[mod].co2avg.length>gs_maxco2avg)
	  g_co2stat[mod].co2avg.shift();
	// Check on last co2 average if goes up or down
	var delta=0;
	var last_delta=0;
	for (i=0;i<g_co2stat[mod].co2avg.length;i++)
	{
		if (last!=-1)
		{
			if (last!=-1 && last>g_co2stat[mod].co2avg[i])
			{
				last_delta=(last-g_co2stat[mod].co2avg[i]);
				delta-=last_delta;
				inc=0;  
			}
			else if (last!=-1 && last<g_co2stat[mod].co2avg[i])
			{
				last_delta=(g_co2stat[mod].co2avg[i]-last);
				delta+=last_delta;
				dec=0;
			}
		}
		last=g_co2stat[mod].co2avg[i];
	}
	g_co2stat[mod].last_evol=g_co2stat[mod].current_evol;
	if (dec==1 && inc==1) g_co2stat[mod].current_evol=0;
	else if (dec==1) g_co2stat[mod].current_evol=-1;
	else if (inc==1) g_co2stat[mod].current_evol=1;
	else if (dec==0 && inc==0) 
	{
	  g_co2stat[mod].current_evol=0;
	  if (delta>0) g_co2stat[mod].current_evol=1;
	  if (delta<0) g_co2stat[mod].current_evol=-1;
	}
	if ((g_debug&4)!=0)
		console.log("N#"+g_names[mod]+": S:"+sum+" #"+g_co2histo[mod].length+" L:"+last+" LV:"+last_value+" m:"+g_co2stat[mod].min+" M:"+g_co2stat[mod].max+" D/I:"+dec+","+inc+" D:"+delta+" T:"+g_co2stat[mod].current_evol);
	// Change in CO2 values ?
	if (g_co2stat[mod].last_evol!=g_co2stat[mod].current_evol)
	{
	  // Save alert date
 	  g_co2stat[mod].alert=0;
 	  g_co2stat[mod].last_delta=g_co2stat[mod].delta;
 	  g_co2stat[mod].delta=last_delta;
	  switch(g_co2stat[mod].current_evol)
	  {
	    case 0:
		  switch(g_co2stat[mod].last_evol)
		  {
		    case 1:
				// CO2 goes up then stabilize 
				g_co2stat[mod].txt="";
				break;
			case -1:
				// CO2 goes down then stabilize: alert user than CO2 is back to normal value
				g_co2stat[mod].txt="";
				if (g_co2stat[mod].last_delta<gs_minco2downvariation)
					g_co2stat[mod].txt=gs_msg_advice_start+g_names[mod]+gs_msg_co2stabilize+last+" "+g_netatmo_unit[1];
				break;
		  }
		  break;
		case 1:
		  switch(g_co2stat[mod].last_evol)
		  {
		    case 0:
				// CO2 stabilize then goes up 
			case -1:
				// CO2 goes down then goes up 
				g_co2stat[mod].txt="";
				break;
		  }
		  break;
		case -1:
		  switch(g_co2stat[mod].last_evol)
		  {
		    case 0:
				// CO2 goes up then goes down 
				g_co2stat[mod].txt="";
				break;
			case 1:
				// CO2 stabilize then goes down 
				g_co2stat[mod].txt="";
				if (last_value<gs_minco2fine && g_co2stat[mod].delta<gs_minco2downvariation)
					g_co2stat[mod].txt=gs_msg_advice_start+g_names[mod]+gs_msg_co2nowfine;
				break;
		  }
		  break;
	  }
	  if (g_co2stat[mod].txt!="")
	    g_co2stat[mod].alert=1;
	}
	else
	{
 	  g_co2stat[mod].delta+=last_delta;
	  switch(g_co2stat[mod].current_evol)
	  {
		case 0:
		  break;
		case 1:
		  if (delta>gs_maxco2upvariation)
			g_co2stat[mod].txt=gs_msg_advice_start+g_names[mod]+gs_msg_co2quickup;
		  break;
		case -1:
		  if (last_value<gs_minco2fine && g_co2stat[mod].delta<gs_minco2downvariation)
			g_co2stat[mod].txt=gs_msg_advice_start+g_names[mod]+gs_msg_co2nowfine;
		  break;
	  }
	  if (g_co2stat[mod].txt!="")
 	    g_co2stat[mod].alert=1;
	}
	return g_co2stat;
}

var getUnit = function(index)
{
  if (index>g_netatmo_unit.length)
    return "";
  return g_netatmo_unit[index];
}

var getTitle = function(index)
{
  if (index>g_netatmo_title.length)
    return "";
  return g_netatmo_title[index];
}

var isPertinent = function(module, index)
{
  switch(module)
  {
     case "NAMain": // Main device
	   if (index>=0 && index<=4) return true;
	   break;
     case "NAModule1": // External device
	   if (index==0 || index==2) return true;
	   break;
     case "NAModule4": // 'Add on' device
	   if (index>=0 && index<=2) return true;
	   break;
  }
  return false;
}

var checkParam=function(param, defaultvalue)
{
  if (typeof param==='undefined')
  // param not defined
    return -1;
  switch(typeof defaultvalue)
  {
    case "string":
	  if (param==defaultvalue)
	    // is default value
	    return 0;
	  break;
	case "object":
	  for (i=0;i<defaultvalue.length;i++)
	  {
		r=checkParam(param, defaultvalue[i]);
		if (r==0) return r;
	  }
	  break;
	case "number":
	default:
	  if (parseInt(param)==defaultvalue)
	    // is default value
	    return 0;
	  break;
  }
  // not setted to default value
  return 1;
}

function getCO2Advice(value, section, init)
{
	if (init!=4)
	{
		if (value<400) g_air[0]+=section+",";
		if (value>=400 && value<=600) g_air[1]+=section+",";
		if (value>600 && value<=800) g_air[2]+=section+",";
	}
	if (value>800 && value<=1000)  g_air[3]+=section+",";
	if (value>1000) g_air[4]+=section+",";
}

var getAdvice = function(data, config, type, mode, section, value)
{
  switch(mode)
  {
    case 1: // Air quality
	    if (data.init==4)
		{
		   // For CRON
		   if (checkParam(config.max_co2,"")>0)
			if (parseInt(config.max_co2)!=-1)
				if (value>=parseInt(config.max_co2)) g_air[4]+=section+",";
			else
				getCO2Advice(value, section, data.init);
		}
		else
		{
		  if (parseInt(config.co2_quality)==1)
			getCO2Advice(value, section, data.init);
		}
		break;
	case 0: // Temperature
	    if (type=="NAModule1")
		{
	      if (checkParam(config.max_exttemp,"")>0 && value>parseInt(config.max_exttemp)) g_exttemp[0]+=section+",";
		  if (checkParam(config.min_exttemp,"")>0 && value<parseInt(config.min_exttemp)) g_exttemp[1]+=section+",";
		}
		else
		{
	      if (checkParam(config.max_temp,"")>0 && value>parseInt(config.max_temp)) g_temp[0]+=section+",";
		  if (checkParam(config.min_temp,"")>0 && value<parseInt(config.min_temp)) g_temp[1]+=section+",";
		}
		break;
	case 2: // Humidity
		if (type=="NAModule1")
		{
	      if (checkParam(config.max_exthumidity,"")>0 && value>parseInt(config.max_exthumidity)) g_exthumidity[0]+=section+",";
	      if (checkParam(config.min_exthumidity,"")>0 && value<parseInt(config.min_exthumidity)) g_exthumidity[1]+=section+",";
		}
		else
		{
	      if (checkParam(config.max_humidity,"")>0 && value>parseInt(config.max_humidity)) g_humidity[0]+=section+",";
	      if (checkParam(config.min_humidity,"")>0 && value<parseInt(config.min_humidity)) g_humidity[1]+=section+",";
		}
		break;
	case 4: // Noise
	    if (checkParam(config.max_noise,"")>0 && value>parseInt(config.max_noise)) g_noise[0]+=section+",";
		break;
  }
}

var checkBattery=function(type, section, index)
{
  if (type=="NAMain")
  {
    g_batt[index]=-1;
    return;
  }
  // This is experimental: I don't know the high and low limit mV of the Netatmo batteries
  // <3000 : batteries near empty ?
  if (g_lvlbattery[index]<gs_batterylow)
    g_batt[index]=0;
  else
    g_batt[index]=Math.round((g_lvlbattery[index]-gs_batterylow)*100/(gs_batteryhigh-gs_batterylow));
  if (g_batt<20)
    g_battery[0]+=section+",";
  else if (g_batt<50)
    g_battery[1]+=section+",";
}

var resetAdvice=function()
{
  for (i=0;i<g_air.length;i++)
    g_air[i]="";
  for (i=0;i<g_temp.length;i++)
    g_temp[i]="";
  for (i=0;i<g_exttemp.length;i++)
    g_exttemp[i]="";
  for (i=0;i<g_noise.length;i++)
    g_noise[i]="";
  for (i=0;i<g_humidity.length;i++)
    g_humidity[i]=""; 
  for (i=0;i<g_exthumidity.length;i++)
    g_exthumidity[i]=""; 
  for (i=0;i<g_battery.length;i++)
    g_battery[i]=""; 
  return 0;
}

var buildAdvice=function(data)
{
  var advice="";
  if (data.init==4)
  {
    if (g_air[4]!="")
	  advice+=gs_msg_advice_start+g_air[4]+gs_msg_advice_co2max;
  }
  else
    for (i=0;i<g_air.length;i++)
      if (g_air[i]!="")
	    advice+=gs_msg_advice_start+g_air[i]+g_advice_air[i];
  for (i=0;i<g_temp.length;i++)
    if (g_temp[i]!="")
	  advice+=gs_msg_advice_start+g_temp[i]+g_advice_temp[i];
  for (i=0;i<g_exttemp.length;i++)
    if (g_exttemp[i]!="")
	  advice+=gs_msg_advice_start+g_exttemp[i]+g_advice_exttemp[i];
  for (i=0;i<g_humidity.length;i++)
    if (g_humidity[i]!="")
	  advice+=gs_msg_advice_start+g_humidity[i]+g_advice_humidity[i];
  for (i=0;i<g_exthumidity.length;i++)
    if (g_exthumidity[i]!="")
	  advice+=gs_msg_advice_start+g_exthumidity[i]+g_advice_exthumidity[i];
  for (i=0;i<g_noise.length;i++)
    if (g_noise[i]!="")
	  advice+=gs_msg_advice_start+g_noise[i]+g_advice_noise[i];
  if (data.init==4)
	return advice;
  if (advice=="")
	advice=gs_msg_advice_allok;
  return gs_msg_advice_synhabitat+advice;
}

var buildBatteryAdvice=function()
{
  var advice="";
  for (i=0;i<g_battery.length;i++)
    if (g_battery[i]!="")
	  advice+=gs_msg_advice_start+g_battery[i]+g_advice_battery[i];
  return advice;
}

var buildSentenceAndSpeak = function(data,config,SARAH)
{
  var txt="";
  var content="";
  var section="";
  var found=0;
  var advice="";
  
  resetAdvice();
  mode=parseInt(data.mode);
  capteur=parseInt(data.capteur);
  switch (capteur)
  {
	case -1:
	  // Parse all device list
	  for (i=0;i<g_mod;i++)
	  {
		  section=g_names[i];
		  checkBattery(g_types[i],section,i);
		  switch(mode)
		  {
			case -1:
			  // Parse all collected data
			  for (j=0;j<5;j++)
			    if (isPertinent(g_types[i],j)) 
				{
				  content+=getTitle(j)+" "+g_values[i][j]+" "+getUnit(j)+", ";
   			      getAdvice(data, config, g_types[i],j, section, g_values[i][j]);
				}
			  break;
			default:
			  // Only parse wanted data
			  if (isPertinent(g_types[i],mode))
			  {
			    content+=getTitle(mode)+" "+g_values[i][mode]+" "+getUnit(mode)+", ";
   			    getAdvice(data, config, g_types[i],mode, section, g_values[i][mode]);
			  }
			  break;
		  }
		  if (content=="") { if (gs_skip_empty==0) txt+=gs_msg_nodata_msg+section; }
	      else txt+="."+section+":"+content;
		  content="";
	  }
	  break;
	default:
	  section=g_names[capteur];
	  checkBattery(g_types[capteur],section,capteur);
	  switch(mode)
	  {
		case -1:
		  // Parse all collected data
		  for (j=0;j<5;j++)
			if (isPertinent(g_types[capteur],j))
			{
			  content+=getTitle(j)+" "+g_values[capteur][j]+" "+getUnit(j)+", ";
  			  getAdvice(data, config, g_types[capteur],j, section, g_values[capteur][j]);
			}
		  break;
		default:
		  // Only parse wanted data
		  if (isPertinent(g_types[capteur],mode)) 
		  {
		    content+=getTitle(mode)+" "+g_values[capteur][mode]+" "+getUnit(mode)+", ";
			getAdvice(data, config, g_types[capteur],mode, section, g_values[capteur][mode]);
		  }
		  break;
	  }
      if (content=="") { if (gs_skip_empty==0) txt+=gs_msg_nodata_msg+section; }
      else txt+="."+section+":"+content;
	  content="";
	  break;
  }
  var advice=buildAdvice(data);
  if (data.silent==0)
  {
	if (data.conseil=="1")
	  SARAH.speak(advice);
    else if (config.advice_odo=="0")
	  SARAH.speak(txt +"." + advice);
    else
      SARAH.speak(txt);
  }
  return advice;
}

// For Debug purpose only
var showDevice = function()
{
	for (i=0;i<g_mod;i++)
	{
		console.log("["+i+"]:"+g_names[i]+":")
		switch(g_types[i])
		{
			case "NAMain":
			  console.log("Battery: No batteries");
			  break;
			case "NAModule1":
			case "NAModule4":
			  console.log("Battery: "+g_lvlbattery[i]+" mV");
			  break;
		}
	    for (j=0;j<5;j++)
		  if (isPertinent(g_types[i],j)) 
			console.log(getTitle(j)+":"+g_values[i][j]+" "+getUnit(j));
	}
}
