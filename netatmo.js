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
var g_names;
var g_count=0;
var g_req=0;
var g_skip_empty=1;
// Sarah advice
var gs_msg_advice_allok="Rien à signaler de particulier";
var gs_msg_advice_synhabitat="Voici le bilan de l'habitat:";
var g_advice_start="Dans:"
var g_air=new Array(4);
var g_advice_air=new Array
					(
						"la qualité de l'air est moyenne, si vous avez le temps, penser à aérer...",
						"la qualité de l'air est modérée, il faudrait aérer...",
						"la qualité de l'air est médiocre, il faut aérer rapidement...",
						"la qualité de l'air est dangereuse, aérer tout de suite..."
					);
var g_temp=new Array(4);
var g_advice_temp=new Array
				(
					"la tempèrature est élevé, veillez à moins chauffer.",
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
var g_errsettings="Les paramètre Nette atmo sont incomplet, veuillez les renseigner";
var g_okletshavealook="Je me renseigne";
var g_errornetatmosite="Impossible de joindre Netatmo";
var g_netatmoxmlfile="netatmo.xml";

var init_callback=function(opts)
{
  return ;
}

exports.init = function (SARAH)
{
  var config=SARAH.ConfigManager.getConfig();
  config = config.modules.netatmo;
  if (!config.email || !config.password || !config.id || !config.secret)
  {
	SARAH.speak(g_errsettings);
	return ;
  }
  var data = {};
  data.init=1;
  getToken(gs_token_url, config.email, config.password, config.id, config.secret, data, init_callback, config);
}

exports.action = function(data, callback, config, SARAH) 
{
  var config = config.modules.netatmo;
  
  if (!config.email || !config.password || !config.id || !config.secret)
    return callback({'tts': g_errsettings});
  SARAH.speak (g_okletshavealook); 
  getToken(gs_token_url, config.email, config.password, config.id, config.secret, data, callback, config);
}

var getURL = function(url, data, callback, config, cb)
{
	var request = require('request');
	request(
				{'uri': url}
				, function (err, response, body)
				{
					if (err || response.statusCode != 200) 
					{
					  callback({'tts': g_errornetatmosite});
					  return -1;
					}
					cb (body, data, callback, config);
				}
			);
	return -2;
}

var getURL2 = function(url, data, callback, config, cb, mod)
{
	var request = require('request');
	request(
				{'uri': url}
				, function (err, response, body)
				{
					if (err || response.statusCode != 200) 
					{
					  callback({'tts': g_errornetatmosite});
					  return -1;
					}
					cb (body, data, callback, config, mod);
				}
			);
	return -2;
}
var getToken = function(url, username, password, id, secret, data, callback, config)
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
					console.log("Netatmo error:"+response.statusCode);
					callback({'tts': g_errornetatmosite});
					return -1;
				}
				parseToken(body, data, callback, config);
			});
	return -2;
}

var parseToken = function(body, data, callback, config)
{
	var json = JSON.parse(body);

	g_token = json.access_token;
	g_expiresin = json.expires_in;
	g_refresh_token = json.refresh_token;
    device_list_url=gs_device_list_url+g_token;
    getURL(device_list_url, data, callback, config, parseDeviceList);
	return 0;
}

var parseDeviceList = function(body, data, callback, config)
{
	var json = JSON.parse(body);

    g_req=0;
	// Maximize g_names and g_types to avoid pre count
	g_names=new Array(json.body.devices.length*4);
	g_types=new Array(json.body.devices.length*4);
	g_mod=0;
    config_xml="";
	// Extract devices and modules to an 1 dim array
	for (i=0;i<json.body.devices.length;i++)
	{
	  config_xml+="		<item>"+json.body.devices[i].module_name+"<tag>out.action.capteur="+g_mod+";</tag></item>\n";
	  g_names[g_mod]=json.body.devices[i].module_name;
	  g_types[g_mod++]=json.body.devices[i].type;
	  for (j=0;j<json.body.devices[i].modules.length;j++)
	  {
	    for (k=0;k<json.body.modules.length;k++)
			if (json.body.devices[i].modules[j]==json.body.modules[k]._id)
			{
				config_xml+="		<item>"+json.body.modules[k].module_name+"<tag>out.action.capteur="+g_mod+";</tag></item>\n";
				g_names[g_mod]=json.body.modules[k].module_name;
				g_types[g_mod++]=json.body.modules[k].type;
			}
	  }
	} 
	// Create Data array (Temp, Pressure, Noise, Humidity, CO2
	g_values=new Array(g_mod);
	for (i=0;i<g_mod;i++) g_values[i]=new Array(5);
	// Get Devices and modules info and save its
	count=0
	if (data.init==1)
	{
	  // Update Netatmo.xml with netatmo settings parameters
	  var fs   = require('fs');
	  var file = __dirname + "\\" + g_netatmoxmlfile;
	  var xml  = fs.readFileSync(file,'utf8');
	  var regexp = new RegExp('§[^§]+§','gm');
      var xml    = xml.replace(regexp, "§ -->\n" + config_xml + "<!-- §");
      fs.writeFileSync(__dirname+"\\"+g_netatmoxmlfile, xml, 'utf8');
	}
	else
	    // Get the data
		for (i=0;i<json.body.devices.length;i++)
		{
		  measure_url = gs_measure_url+g_token+'&device_id='+json.body.devices[i]._id+'&type=Temperature,CO2,Humidity,Pressure,Noise&scale=max&date_end=last';
		  getURL2(measure_url, data, callback, config, parseMeasure,count++);
		  for (j=0;j<json.body.devices[i].modules.length;j++)
		  {
			measure_url = gs_measure_url+g_token+'&device_id='+json.body.devices[i]._id+'&module_id='+json.body.modules[j]._id+'&type=Temperature,CO2,Humidity,Pressure&scale=max&date_end=last';
			getURL2(measure_url, data, callback, config, parseMeasure,count++);
		  }
		}
	return 0;
}

var parseMeasure = function(body, data, callback, config, mod)
{
	var json= JSON.parse(body);
    g_req++;
	//console.log(mod+":"+body);
	switch(g_types[mod])
	{
	  // Main netatmo device
	  case "NAMain":
		g_values[mod][0]=json.body[0].value[0][0]; // Temperature
		g_values[mod][1]=json.body[0].value[0][1]; // CO2
		g_values[mod][2]=json.body[0].value[0][2]; // Humidity
		g_values[mod][3]=json.body[0].value[0][3]; // Pressure
		g_values[mod][4]=json.body[0].value[0][4]; // Noise
		break;
      // External netatmo device
	  case "NAModule1":
		g_values[mod][0]=json.body[0].value[0][0]; // Temperature
		g_values[mod][2]=json.body[0].value[0][2]; // Humidity
		g_values[mod][1]=0; 
		g_values[mod][3]=0; 
		g_values[mod][4]=0; 
		break;
	  // Add on netatmo device
	  case "NAModule4":
		g_values[mod][0]=json.body[0].value[0][0]; // Temperature
		g_values[mod][1]=json.body[0].value[0][1]; // CO2
		g_values[mod][2]=json.body[0].value[0][2]; // Humidity
		g_values[mod][3]=0; 
		g_values[mod][4]=0; 
		break;
	}
    if (g_req==g_mod && data.mode && data.capteur)
	{
//	  showAll();
	  buildDataAndSpeak(data,callback,config);
	}
	return 0;
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
     case "NAMain":
	   if (index>=0 && index<=4) return true;
	   break;
     case "NAModule1":
	   if (index==0 || index==2) return true;
	   break;
     case "NAModule4":
	   if (index>=0 && index<=2) return true;
	   break;
  }
  return false;
}

var getAdvice = function(type, mode, section, value)
{
  if (type=="NAModule1") return;
  switch(mode)
  {
    case 1:
		if (value>=400 && value<=600) g_air[0]+=section+",";
		else if (value>600 && value<=800) g_air[1]+=section+",";
		else if (value>800 && value<=1000)  g_air[2]+=section+",";
		else if (value>1000) g_air[3]+=section+",";
		break;
	case 0: // Temperature
	    if (value>23) g_temp[0]+=section+",";
		else if (value<18) g_temp[1]+=section+",";
		break;
	case 2: // Humidité
	    if (value>80) g_humidity[0]+=section+",";
		break;
	case 4: // Bruit
	    if (value>60) g_noise[0]+=section+",";
		break;
  }
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
  return 0;
}

var buildAdvice=function()
{
  var advice="";
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
  advice=gs_msg_advice_synhabitat+advice;
  return advice;
}

var buildDataAndSpeak = function(data,callback,config)
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
	  for (i=0;i<g_mod;i++)
	  {
		  section=g_names[i];
		  switch(mode)
		  {
			case -1:
			  for (j=0;j<5;j++)
			    if (isPertinent(g_types[i],j)) 
				{
				  content+=getTitle(j)+" "+g_values[i][j]+" "+getUnit(j)+", ";
   			      getAdvice(g_types[i],j, section, g_values[i][j]);
				}
			  break;
			default:
			  if (isPertinent(g_types[i],mode))
			  {
			    content+=getTitle(mode)+" "+g_values[i][mode]+" "+getUnit(mode)+", ";
   			    getAdvice(g_types[i],mode, section, g_values[i][mode]);
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
	  switch(mode)
	  {
		case -1:
		  for (j=0;j<5;j++)
			if (isPertinent(g_types[capteur],j))
			{
			  content+=getTitle(j)+" "+g_values[capteur][j]+" "+getUnit(j)+", ";
  			  getAdvice(g_types[capteur],j, section, g_values[capteur][j]);
			}
		  break;
		default:
		  if (isPertinent(g_types[capteur],mode)) 
		  {
		    content+=getTitle(mode)+" "+g_values[capteur][mode]+" "+getUnit(mode)+", ";
			getAdvice(g_types[capteur],mode, section, g_values[capteur][mode]);
		  }
		  break;
	  }
      if (content=="") { if (g_skip_empty==0) txt+=g_nodata_msg+section; }
      else txt+="."+section+":"+content;
	  content="";
	  break;
  }
  advice=buildAdvice();
  if (data.conseil=="1")
	callback({'tts': advice});
  else if (data.advice=="1")
	callback({'tts': txt +"." + advice});
  else
    callback({'tts': txt});
  console.log(txt);
  return 0;
}

// For Debug purpose
var showAll = function()
{
	for (i=0;i<g_mod;i++)
	{
		console.log("["+i+"]:"+g_names[i]+":")
		switch(g_types[i])
		{
			case "NAMain":
			  for (j=0;j<5;j++)
				console.log(getTitle(j)+":"+g_values[i][j]+" "+getUnit(j));
			  break;
			case "NAModule1":
			  j=0;console.log(getTitle(j)+":"+g_values[i][j]+" "+getUnit(j));
			  j=2;console.log(getTitle(j)+":"+g_values[i][j]+" "+getUnit(j));
			  break;
			case "NAModule4":
			  for (j=0;j<3;j++)
				console.log(getTitle(j)+":"+g_values[i][j]+" "+getUnit(j));
			  break;
		}
	}
}
