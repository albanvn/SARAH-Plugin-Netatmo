/***************************************************
  Netatmo2 Plugin For SARAH
  Author: Alban Vidal-Naquet (albanvn@gmail.com)
  Date: 29/09/2013
  File: netatmo2.js
 ***************************************************/

//////////////////////////////////////////////////////
// TODO LIST:
// -Manage a group of device: "Interieur": "1-3", "Exterieur": "0", "Other": "4-8", "All": "0-8"
// -Check variation CO2 (chute) pour aération...
//////////////////////////////////////////////////////

// Netatmo URL
var gs_token_url = 'http://api.netatmo.net/oauth2/token';
var gs_device_url = 'http://api.netatmo.net/api/getuser?access_token=';
var gs_device_list_url = 'http://api.netatmo.net/api/devicelist?access_token=';
var gs_measure_url = 'http://api.netatmo.net/api/getmeasure?access_token=';
// Netatmo token & connection data
var g_token = "";
var g_expiresin = "";
var g_refresh_token = "";
// Netatmo data
var g_values;
var g_types;
var g_lvlbattery;
var g_batt;
var g_names;
var g_mod=0;
var g_req=0;
var g_skip_empty=1;
var g_netatmoxmlfile="netatmo2.xml";
const gs_batteryhigh=6000;
const gs_batterylow=3500;
// Sarah advice and message
var gs_msg_advice_allok="Rien à signaler de particulier";
var gs_msg_advice_synhabitat="Voici le bilan de l'habitat:";
var g_advice_start="Dans:"
var g_air=new Array(5);
var g_advice_air=new Array
					(
					    "la qualité de l'air est excellente,.",
						"la qualité de l'air est bonne,.",
						"la qualité de l'air est modérée, si vous avez le temps, pensez à aérer,.",
						"la qualité de l'air est médiocre, il faut aérer rapidement,.",
						"la qualité de l'air est nocive, aérer tout de suite,."
					);
var g_temp=new Array(4);
var g_advice_temp=new Array
				(
					"la tempèrature est élevé, veillez à moins chauffer ou à aérer.",
					"la tempèrature est basse, veillez à plus chauffer."
				);
var g_humidity=new Array(4);
var g_advice_humidity=new Array
				(
					"l'humidité est élevé, veillez à déshumidifer.",
					"l'humidité est basse, veillez à humidifier."
				);
var g_noise=new Array(4);
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
					
var g_nodata_msg=".Aucune donnée pour ";
var g_errsettings="Les paramètre du pleug ine Nette atmo sont incomplet, veuillez les renseigner";
var g_okletshavealook="Je me renseigne";
var g_errornetatmosite="Impossible de joindre Netatmo";
var g_allisfine="Rien à signaler de particulier";
var g_advice_co2max="Le niveau maximum de CO2 à été dépassé, il faut aérer";
var g_co2histo=new Array();
var g_co2histosize=10;
var g_lastalert=0;
var g_lastalert_co2stable=0;
var g_lastalert_co2down=0;
var g_flag_co2dec=0;
var g_co2dec_date=0;
var g_co2stable_date=0;
var g_flag_co2stable=0;
// Alert duration: 1 hour
var g_alertduration=60*60*1000;

//////////////////////
// EMPTY CALLBACK
//////////////////////
var init_callback=function(opts)
{
  return ;
}

/////////////////////
// SARAH MODULE INIT FUNCTION
/////////////////////
exports.init = function (SARAH)
{
  var config=SARAH.ConfigManager.getConfig();
  config = config.modules.netatmo2;
  if (!config.email || !config.password || !config.id || !config.secret)
  {
	SARAH.speak(g_errsettings);
	return ;
  }
  var data = {};
  data.init=1;
  getToken(gs_token_url, config.email, config.password, config.id, config.secret, data, init_callback, config, SARAH);
  return ;
}

/////////////////////
// SARAH MODULE ACTION FUNCTION
/////////////////////
exports.action = function(data, callback, config, SARAH) 
{
  var config = config.modules.netatmo2;
  
  if (!config.email || !config.password || !config.id || !config.secret)
    return SARAH.speak(g_errsettings);
  SARAH.speak(g_okletshavealook); 
  data.silent=0;
  if (data.init==4)
    data.silent=1;
  if (getToken(gs_token_url, config.email, config.password, config.id, config.secret, data, callback, config, SARAH)!=0)
    callback();
}

var fillInfo=function(connexion,names,values,batt)
{
  var info={};
  
  info.error=0;
  info.names=names;
  info.values=values;
  info.connexion=connexion;
  info.battery=batt;
  return info;
}

/////////////////////
// SARAH MODULE GETBASIC FUNCTION
/////////////////////
var getBasic = function(config, SARAH)
{
  var config = config.modules.netatmo2;
  var data={};
  var info={};
  
  data.init=2;
  info=fillInfo(g_connexion,g_names,g_values,g_batt);
  if (!config.email || !config.password || !config.id || !config.secret)
  {
    info.error=1;
    return info;
  }
  // Refresh for the next time the netatmo data
  getToken(gs_token_url, config.email, config.password, config.id, config.secret, data, init_callback, config, SARAH);
  return info;
}

exports.getBasic=getBasic;

////////////////////////
// PRIVATE FUNCTION
////////////////////////

var getURL = function(url, data, callback, config, mycallback, arg, SARAH)
{
	var request = require('request');
	request(
				{'uri': url}
				, function (err, response, body)
				{
					if (err || response.statusCode != 200) 
					{
					  console.log("getURL error:"+response.statusCode);
					  if (data.silent==0)
					    SARAH.speak(g_errornetatmosite);
					  return -1;
					}
					return mycallback (body, data, callback, config, arg, SARAH);
				}
			);
	return -2;
}

var getToken = function(url, username, password, id, secret, data, callback, config, SARAH)
{
	var request = require('request');
	request({ 
				'uri'     : url,
				'method'  : 'post',
				'headers' : { 
						   'Content-type'   : 'application/x-www-form-urlencoded;charset=UTF-8'
						   },
				'form'    : {    
							'grant_type' 	: "password",
							'client_id' 	: id,
							'client_secret' : secret,
							'username' 	: username,
							'password' 	: password
							}
			}, function (err, response, body)
			{
				if (err || response.statusCode != 200) 
				{
					console.log("getToken error:"+response.statusCode);
					if (data.silent==0) 
					  SARAH.speak(g_errornetatmosite);
					return -1;
				}
				return parseToken(body, data, callback, config, SARAH);
			});
	return -2;
}

var parseToken = function(body, data, callback, config, SARAH)
{
	var json = JSON.parse(body);

	g_token = json.access_token;
	g_expiresin = json.expires_in;
	g_refresh_token = json.refresh_token;
	g_connexion=1;
    device_list_url=gs_device_list_url+g_token;
    getURL(device_list_url, data, callback, config, parseDeviceList, 0, SARAH);
	return 0;
}

var parseDeviceList = function(body, data, callback, config, arg, SARAH)
{
	var json = JSON.parse(body);

    g_req=0;
	// Maximize g_names and g_types to avoid pre count
	g_names=new Array(json.body.devices.length*4);
	g_types=new Array(json.body.devices.length*4);
	g_lvlbattery=new Array(json.body.devices.length*4);
	g_batt=new Array(json.body.devices.length*4);
	g_co2histo=new Array(json.body.devices.length*4);
	g_resume=new Array(json.body.devices.length*4);
	g_mod=0;
    config_xml="";
	// Extract devices and modules to an 1 dim array
	for (i=0;i<json.body.devices.length;i++)
	{
	  config_xml+="		<item>"+json.body.devices[i].module_name+"<tag>out.action.capteur=\""+g_mod+"\";</tag></item>\n";
	  g_co2histo[g_mod]=new Array();
	  g_names[g_mod]=json.body.devices[i].module_name;
	  g_types[g_mod]=json.body.devices[i].type;
	  g_lvlbattery[g_mod++]=-1;
	  for (j=0;j<json.body.devices[i].modules.length;j++)
	  {
	    for (k=0;k<json.body.modules.length;k++)
			if (json.body.devices[i].modules[j]==json.body.modules[k]._id)
			{
				config_xml+="		<item>"+json.body.modules[k].module_name+"<tag>out.action.capteur=\""+g_mod+"\";</tag></item>\n";
				g_co2histo[g_mod]=new Array();
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
	count=0
	if (data.init==2 || data.init==3)
	{
	  resetAdvice();
	  // Check Battery
	  for (i=0;i<g_mod;i++)
		  checkBattery(g_types[i],g_names[i],i);
	  if (data.init==3)
	  {
	    var txt=buildBatteryAdvice();
		if (txt=="") 
			txt=g_allisfine;
		if (data.silent==0)
		  SARAH.speak(txt);
	  }
	}
	else if (data.init==1)
	{
	  // Update Netatmo2.xml with netatmo settings parameters
	  var fs   = require('fs');
	  var file = __dirname + "\\" + g_netatmoxmlfile;
	  var xml  = fs.readFileSync(file,'utf8');
	  var regexp = new RegExp('§[^§]+§','gm');
      var xml    = xml.replace(regexp, "§ -->\n" + config_xml + "<!-- §");
      fs.writeFileSync(__dirname+"\\"+g_netatmoxmlfile, xml, 'utf8');
      resetAdvice();
	  // Check Battery
	  for (i=0;i<g_mod;i++)
		  checkBattery(g_types[i],g_names[i],i);
	}
	else
	    // Get the data
		for (i=0;i<json.body.devices.length;i++)
		{
		  measure_url = gs_measure_url+g_token+'&device_id='+json.body.devices[i]._id+'&type=Temperature,CO2,Humidity,Pressure,Noise&scale=max&date_end=last';
		  getURL(measure_url, data, callback, config, parseMeasure,count++, SARAH);
		  for (j=0;j<json.body.devices[i].modules.length;j++)
		  {
			measure_url = gs_measure_url+g_token+'&device_id='+json.body.devices[i]._id+'&module_id='+json.body.modules[j]._id+'&type=Temperature,CO2,Humidity,Pressure&scale=max&date_end=last';
			getURL(measure_url, data, callback, config, parseMeasure,count++, SARAH);
		  }
		}
	return 0;
}

var parseMeasure = function(body, data, callback, config, mod, SARAH)
{
	var json= JSON.parse(body);
    g_req++;
	//console.log(mod+":"+body);
	var co2=-1;
	switch(g_types[mod])
	{
	  // Main netatmo device
	  case "NAMain":
		g_values[mod][0]=json.body[0].value[0][0]; // Temperature
		g_values[mod][1]=json.body[0].value[0][1]; // CO2
		g_values[mod][2]=json.body[0].value[0][2]; // Humidity
		g_values[mod][3]=json.body[0].value[0][3]; // Pressure
		g_values[mod][4]=json.body[0].value[0][4]; // Noise
		co2=json.body[0].value[0][1];
		break;
      // External netatmo device
	  case "NAModule1":
		g_values[mod][0]=json.body[0].value[0][0]; // Temperature
		g_values[mod][2]=json.body[0].value[0][2]; // Humidity
		g_values[mod][1]=-1; // ignored
		g_values[mod][3]=-1; // ignored
		g_values[mod][4]=-1; // ignored 
		break;
	  // 'Add on' netatmo device
	  case "NAModule4":
		g_values[mod][0]=json.body[0].value[0][0]; // Temperature
		g_values[mod][1]=json.body[0].value[0][1]; // CO2
		g_values[mod][2]=json.body[0].value[0][2]; // Humidity
		g_values[mod][3]=-1; // ignored
		g_values[mod][4]=-1; // ignored
		co2=json.body[0].value[0][1];
		break;
	}
	if (co2!=-1)
	{
		// Save current co2 in co2 histo
		var size=g_co2histo[mod].length;
		// If array is full, then shift the first item
		if (size==g_co2histosize)
		  g_co2histo.shift();
		// Save new item
		g_co2histo[mod].push(co2);
	}
	// Share netatmo info...
	SARAH.context.Netatmo2Info=fillInfo(g_connexion, g_names, g_values, g_batt);
	var advice="";
    if (g_req==g_mod)
	{
		 advice=buildSentenceAndSpeak(data,callback,config, SARAH);
		 if (data.init==4 && advice!="")
		 {
		   now=new Date();
		   // For CRON...

/*		   
TODO NOW FOR CRON
		   for (i=0;i<g_mod;i++)
				AnalyseCO2(i);
		   
		   if (g_flag_co2stable==1 && now.getTime()>=(g_lastalert_co2stable+g_alertduration))
		   {
		     SARAH.speak(advice_co2stable);
		     g_lastalert_co2stable=now;
		   }
		   if (g_flag_co2down==1 && now.getTime()>=(g_lastalert_co2down+g_alertduration))
		   {
		     SARAH.speak(advice_co2down);
		     g_lastalert_co2down=now;
		   }
		   if (advice!=null && now.getTime()>=(g_lastalert+g_alertduration))
		   {
		     SARAK.speak(advice);
		     g_lastalert=now;
		   }
*/		   
		   callback();
		 } 
    }
	return 0;
}

var AnalyseCO2=function(mod)
{
    var now=new Date();
	var flag_dec=0;
	var last=-1;
	for (i=0;i<g_co2histo[mod].length;i++)
	{
	 if (last!=-1)
	   if (g_co2histo[mod][i]<last)
		 flag_dec+=i;
	 if ((i%2)==1)
	   sum+=g_co2histo[mod][i];
	 else
	   sum-=g_co2histo[mod][i];
	 last=g_co2histo[mod][i];
	}
	if (flag_dec>30)
	{ 
	 if (g_co2dec_date==0)
	 {
	   g_flag_co2dec=1;
	   g_co2dec_date=now;
	   console.log("Start co2 down at"+g_co2dec_date);
	 }
	}
	else
	{
	 g_flag_co2dec=0;
	 g_co2dec_date=0;
	}
	if (i%2==0)
	 sum+=last;
	if (sum<50 && sum>-50)
	{
	 if (g_co2stable_date==0)
	 {
	   g_flag_co2stable=1;
	   g_co2stable_date=now;
	   console.log("Start co2 stable at"+g_co2stable_date);
	 }
	}
	else
	{
	  g_flag_co2stable=0;
	  g_co2stable_date=0;
	}
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

var getAdvice = function(data, config, type, mode, section, value)
{
  if (parseInt(config.ignore_external)==1 && type=="NAModule1") 
    return;
  switch(mode)
  {
    case 1: // Air quality
	    if (data.init==4)
		{
		   // For CRON
		   if (value>=config.max_co2) g_air[4]+=section+",";
		}
		else
		{
		  if (value<400) g_air[0]+=section+",";
		  else if (value>=400 && value<=600) g_air[1]+=section+",";
		  else if (value>600 && value<=800) g_air[2]+=section+",";
		  else if (value>800 && value<=1000)  g_air[3]+=section+",";
		  else if (value>1000) g_air[4]+=section+",";
		}
		break;
	case 0: // Temperature
	    if (value>parseInt(config.max_temp)) g_temp[0]+=section+",";
		else if (value<parseInt(config.min_temp)) g_temp[1]+=section+",";
		break;
	case 2: // Humidity
	    if (value>parseInt(config.max_humidity)) g_humidity[0]+=section+",";
	    else if (value<parseInt(config.min_humidity)) g_humidity[1]+=section+",";
		break;
	case 4: // Noise
	    if (value>parseInt(config.max_noise)) g_noise[0]+=section+",";
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
  for (i=0;i<g_noise.length;i++)
    g_noise[i]="";
  for (i=0;i<g_humidity.length;i++)
    g_humidity[i]=""; 
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
	  advice+=g_advice_start+g_air[4]+g_advice_co2max;
  }
  else
    for (i=0;i<g_air.length;i++)
      if (g_air[i]!="")
	    advice+=g_advice_start+g_air[i]+g_advice_air[i];
  for (i=0;i<g_temp.length;i++)
    if (g_temp[i]!="")
	  advice+=g_advice_start+g_temp[i]+g_advice_temp[i];
  for (i=0;i<g_humidity.length;i++)
    if (g_humidity[i]!="")
	  advice+=g_advice_start+g_humidity[i]+g_advice_humidity[i];
  for (i=0;i<g_noise.length;i++)
    if (g_noise[i]!="")
	  advice+=g_advice_start+g_noise[i]+g_advice_noise[i];
  if (advice=="")
    advice=gs_msg_advice_allok;
  return gs_msg_advice_synhabitat+advice;
}

var buildBatteryAdvice=function()
{
  var advice="";
  for (i=0;i<g_battery.length;i++)
    if (g_battery[i]!="")
	  advice+=g_advice_start+g_battery[i]+g_advice_battery[i];
  return advice;
}

var buildSentenceAndSpeak = function(data,callback,config,SARAH)
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
		  if (content=="") { if (g_skip_empty==0) txt+=g_nodata_msg+section; }
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
      if (content=="") { if (g_skip_empty==0) txt+=g_nodata_msg+section; }
      else txt+="."+section+":"+content;
	  content="";
	  break;
  }
  advice=buildAdvice(data);
  //console.log(txt);
  if (data.silent==0)
  {
	if (data.conseil=="1")
	  SARAH.speak(advice);
    else if (config.advice=="1")
	  SARAH.speak(txt +"." + advice);
    else
      SARAH.speak(txt);
    callback();
  }
  return advice;
}

// For Debug purpose only
var showAll = function()
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
