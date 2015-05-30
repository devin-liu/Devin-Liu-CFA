// Modules

var express = require('express');
var fs = require('fs')
var async = require('async')
var app = express();
var oakland = require('./js/oakland.json').features








// Intializing storage variables

var pathToFile = 'public/database.txt';
var bufferString, bufferStringSplit;
var database_rows = [];
var oakland_rows = [];
var oakland_database = {};
var database = {};

var map_database = [];







// Backend methods

var calculateLngTotal = function(array) {
    var total = 0;
    for (var coord in array) {
        total += array[coord][0]
    }
    return total;
}


var calculateLatTotal = function(array) {
    var total = 0;
    for (var coord in array) {
        total += array[coord][1]
    }
    return total;
}


function parse_oakland(callback) {
    for (row in oakland) {
        var name = oakland[row].properties.NAME;
        var current_row = oakland[row].geometry.coordinates[0]
        var current_row_length = current_row.length

        var avgLng = calculateLngTotal(current_row) / current_row_length;
        var avgLat = calculateLatTotal(current_row) / current_row_length;
        
        oakland_database[name] = {};

        oakland_database[name].coordinates = {
            latitude    : avgLat,
            longitude   : avgLng,
            name        : name
        };

        oakland_rows = oakland_rows.concat(oakland_database[name]);
    }
    // console.log('oakland database done')
    callback(null, oakland_database);
}


function readFile(callback) {
  fs.readFile(pathToFile, function (err, data) {

    bufferString = data.toString();
    bufferStringSplit = bufferString.split(/\n/);
    bufferStringSplit.shift();

    
    var counter = 0;
    var tractRegExp = /Tract ((4|3)\d{3})/;

    for(var row in bufferStringSplit) {
        counter += 1;
        var tract = tractRegExp.exec(bufferStringSplit[row]);
        if (tract) {
         
            tract = tract[1]
        }
        var rowBegin = bufferStringSplit[row].indexOf('122');
        var rowLength = bufferStringSplit[row].length;

        var numberString = bufferStringSplit[row].substring(rowBegin+10, rowLength)

        var numberArray = numberString.trim().split(/\s+/g)

        database[tract] = {}
        database[tract].latitude = bufferStringSplit[row].match(/\s37.\d+/)[0];
        database[tract].longitude = bufferStringSplit[row].match(/-122.\d+/)[0];
        database[tract].land_area = numberArray[0];
        database[tract].population = numberArray[2];
        database[tract].housing_units = numberArray[3];
        database[tract].population_density = parseInt(numberArray[2]) / (parseInt(numberArray[0]) * 0.0000008361);
        database[tract].housing_density = parseInt(numberArray[3]) / (parseInt(numberArray[0]) * 0.0000008361);

        database_rows = database_rows.concat(database[tract])
    }
    // console.log('txt databse done') 
    callback(null, database);
  });
};
 


function mapData(callback) {
    // console.log(database_rows[0])
    // console.log(oakland_rows.length)
    // 37.8044 122.2708
    oakland_rows.sort(function(a,b){
        return ((37.8044 - a.coordinates.latitude) + (122.2708+a.coordinates.longitude)) - ((37.8044 - b.coordinates.latitude) + (122.2708+b.coordinates.longitude));
        // return a.coordinates.latitude - b.coordinates.latitude;
    });
    database_rows.sort(function(a,b){
        return ((37.8044 - a.latitude) + (122.2708+a.longitude)) - ((37.8044 - b.latitude) + (122.2708+b.longitude));
    });
    callback(null)
};

// Parse database and match coordinates
async.series([
    parse_oakland,
    readFile,
    mapData
    ], function(error, results) {
        if (error) console.log(error);
        // console.log('databases gotten');
        // console.log(oakland_rows.length)
        // console.log(database_rows.length)
        // return
        var hit = 0;
        for (var coord in oakland_rows) {
            // hit += 1;
            var name = oakland_rows[coord].coordinates.name;
            var latDif = oakland_rows[coord].coordinates.latitude - database_rows[coord].latitude;
            var lngDif = oakland_rows[coord].coordinates.longitude - database_rows[coord].longitude;
            var dif = Math.abs(latDif + lngDif); 
            // console.log(oakland_rows[coord])
            // console.log(database_rows[coord])
            // console.log(dif)
            if (dif > 0.06) {
                hit +=1
                // console.log(coord)
            } 
            
            if (hit > 1) {
                hit = 0;
                var point = coord + 1;
            } else {
                var point = coord;
            }

            // console.log(point)
            // console.log(database_rows[point])
            if (!database_rows[point] || !database_rows[point].population_density) {
                point += 1;
                // console.log(database_rows[point])
                // console.log(point + ' this kills the progrma')
            } else {
                    var density = parseInt(database_rows[point].population_density / 1000);
                    var housing_density = parseInt(database_rows[point].housing_density / 1000);
                    if (density > 10) density = 10
                    if (housing_density > 10) housing_density = 10
                    // if (density < 1)
                    // var name = map_database[name]
                //     var class_name = ".tract_" + name.split(" ")[0];
                //     if (class_name) class_name = class_name.replace(/\//g, '')
                //     if (density > 10) density = 10
                //     map_database[name] = {
                //     name                : name,
                //     class_name          : class_name,
                //     population_density  : database_rows[point].population_density,
                //     housing_density     : database_rows[point].housing_density,
                //     density_class       : "path.map-density-" + density,
                //     path                : oakland[coord].geometry.coordinates
                // }

                map_database = map_database.concat({
                    "type"       : "Feature",
                    "properties"        : {
                        "NAME"                  : name,
                        "DENSITY_CLASS"         : "map-density-" + density,
                        "POPULATION_DENSITY"    : database_rows[point].population_density,
                        "HOUSING_DENSITY"       : database_rows[point].housing_density,
                        "HOUSING_DENSITY_CLASS" : "housing-density-" + housing_density
                    },
                    "geometry"  : {
                        "type"          : "Polygon",
                        "coordinates"   : oakland[coord].geometry.coordinates
                    }
                })
                // return
                
            }
            

            
            // if (hit == 5) {
            //     console.log(map_database)
            //     return
            // }
        }
    });





// Server routes
app.use("/styles", express.static(__dirname + '/styles'));
app.use("/js", express.static(__dirname + '/js'));


app.get('/', function (req, res) {
  res.sendFile('public/index.html', {root: __dirname });
});


app.get('/api/geomap', function (req, res) {
    res.json(oakland_database)
});

app.get('/api/data', function (req, res) {
    res.json(database)
});

app.get('/api/map_data', function (req, res) {
    
    res.json({
        "type": "FeatureCollection",
        "features": map_database
    })
});

app.get('/api/json_example', function (req, res) {
    res.json(require('./js/oakland.json'))
});

var server = app.listen(3000, function () {

  var host = server.address().address;
  var port = server.address().port;

  console.log('Example app listening at http://%s:%s', host, port);

});