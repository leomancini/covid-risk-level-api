const https = require('https');
const fetch = (url) => {
  let dataString = '';
  return new Promise((resolve, reject) => {
    const req = https.get(url, function(res) {
      res.on('data', chunk => {
        dataString += chunk;
      });
      res.on('end', () => {
        resolve(JSON.parse(dataString));
      });
    });
    
    req.on('error', (e) => {
      reject({
          statusCode: 500,
          body: 'Something went wrong!'
      });
    });
  });
}

exports.handler = async (event) => {
    function parseDate(input) {
      let parts = input.split('-');
      
      return new Date(parts[0], parts[1]-1, parts[2]); // Note: months are 0-based
    }
    
    async function getCovidRiskDataForLatLng(covidRiskDataByCounty, location) {
      let countyInfoData = await fetch(`https://geo.fcc.gov/api/census/block/find?latitude=${location.lat}&longitude=${location.lng}&censusYear=2020&showall=false&format=json`);

      return covidRiskDataByCounty.integrated_county_latest_external_data.filter((covidRiskDataForCounty) => {
        if (parseInt(covidRiskDataForCounty.fips_code) === parseInt(countyInfoData.County.FIPS)) {
          return covidRiskDataForCounty;
        }
      });
    }

    function formatCovidRiskDataForLatLng(data) {
      let riskLevelInteger = parseInt(data.CCL_community_burden_level_integer);
      
      let riskLevelString;
      if (riskLevelInteger === 0) {
        riskLevelString = 'Low';
      } else if (riskLevelInteger === 1) {
        riskLevelString = 'Medium';
      } else if (riskLevelInteger === 2) {
        riskLevelString = 'High';
      }
      
      let lastUpdatedTimestamp = parseDate(data.CCL_report_date);
      
      return {
        stateName: data.State_name,
        countyName: data.County,
        riskLevelInteger,
        riskLevelString,
        lastUpdatedString: lastUpdatedTimestamp.toLocaleDateString('en-us', { year: 'numeric', month: 'long', day: 'numeric' }),
        lastUpdatedTimestamp
      }
    }
    
    const { queryStringParameters } = event;
    
    if (!queryStringParameters || !queryStringParameters.location) {
        return {
            statusCode: 400,
            body: 'Please provide a location!'
        };
    } else {
      let now = Date.now();
      let covidRiskDataByCounty = await fetch(`https://www.cdc.gov/coronavirus/2019-ncov/json/cdt-ccl-data.json?cachebust=${now}`);
  
      let location = queryStringParameters.location.split(',');
      let lat = location[0];
      let lng = location[1];
      
      let covidRiskDataForLatLng = await getCovidRiskDataForLatLng(covidRiskDataByCounty, { lat, lng });
      let covidRiskDataForLatLngFormatted = formatCovidRiskDataForLatLng(covidRiskDataForLatLng[0]);
      
      return covidRiskDataForLatLngFormatted;
    }
};
