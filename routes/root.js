const express = require('express');
const fetch = require('cross-fetch')
const router = express.Router();
const fs = require('@cyclic.sh/s3fs')(process.env.CYCLIC_BUCKET_NAME)
const axios = require('axios');
axios.defaults.baseURL = 'http://localhost:8080';

router.get('/data.json', async (req, res) => {
    let dataJSON;

    fs.readFileSync('./data.json', (error, data) => {
        if(error){
           console.log(error);
           return;
        }
        dataJSON = JSON.parse(data);
        res.json({data: dataJSON});
   })
});

//Updates the data in the table
router.get('/updateData/:first/:last', async (req, res) => {
    await getGuillenNumbers(req.params.first, req.params.last); 
    res.status(200).send("Good");
});

//Builds the JSON file.
router.get('/buildJSON', async (req, res) => {
    await buildJSON();
    res.status(200).send("Good");
});


router.get('/', async (req, res) => {
    const response = await axios.get('./data.json');
    const data = response.data;
    
    res.render('home', {data: data.data});

});

//All MLB teams and their respective IDs
const mlbTeams = [
    { id: 109, name: "Arizona Diamondbacks" },
    { id: 144, name: "Atlanta Braves" },
    { id: 110, name: "Baltimore Orioles" },
    { id: 111, name: "Boston Red Sox" },
    { id: 112, name: "Chicago Cubs" },
    { id: 145, name: "Chicago White Sox" },
    { id: 113, name: "Cincinnati Reds" },
    { id: 114, name: "Cleveland Guardians" },
    { id: 115, name: "Colorado Rockies" },
    { id: 116, name: "Detroit Tigers" },
    { id: 117, name: "Houston Astros" },
    { id: 118, name: "Kansas City Royals" },
    { id: 108, name: "Los Angeles Angels" },
    { id: 119, name: "Los Angeles Dodgers" },
    { id: 146, name: "Miami Marlins" },
    { id: 158, name: "Milwaukee Brewers" },
    { id: 142, name: "Minnesota Twins" },
    { id: 121, name: "New York Mets" },
    { id: 147, name: "New York Yankees" },
    { id: 133, name: "Oakland Athletics" },
    { id: 143, name: "Philadelphia Phillies" },
    { id: 134, name: "Pittsburgh Pirates" },
    { id: 135, name: "San Diego Padres" },
    { id: 137, name: "San Francisco Giants" },
    { id: 136, name: "Seattle Mariners" },
    { id: 138, name: "St. Louis Cardinals" },
    { id: 139, name: "Tampa Bay Rays" },
    { id: 140, name: "Texas Rangers" },
    { id: 141, name: "Toronto Blue Jays" },
    { id: 120, name: "Washington Nationals" }
  ];


const findTotalRBI = async (teamId) => {
    const url = `https://statsapi.mlb.com/api/v1/teams/${teamId}/stats?stats=season&group=hitting&season=2023`;
    const response = await fetch(url);
    const data = await response.json();

    const totalRBI = data.stats[0].splits[0].stat.rbi;
    return totalRBI;
}

const findHomers = async (games, teamId) => {
    let homerRBI = 0;
    const totalRBI = await findTotalRBI(teamId);

    for(game of games) {
        const url = `https://statsapi.mlb.com/api/v1/game/${game.id}/playByPlay`
    
        const response = await fetch(url);
        const data = await response.json();
        const plays = data.allPlays;

        for(const play of plays) {
            if(play.result.event === 'Home Run' && play.about.halfInning === game.homeAway ) {
                console.log(play.result.description);
                homerRBI += play.result.rbi;
            }
        }
    }

    const GN = ((homerRBI / totalRBI) * 100);

    return {teamName: mlbTeams.find(obj => obj.id === teamId).name, homerRBI: homerRBI, totalRBI: totalRBI, GuillenNumber: GN, currentDate: new Date()};
}


const getGameData = async (teamId, season) => {
    const url = `https://statsapi.mlb.com/api/v1/schedule?teamId=${teamId}&season=${season}&sportId=1`;
    //Get request to the API
    const response = await fetch(url);

    //Acquire the JSON data and filter it to games on opening day and beyond.
    const data = await response.json();

    const gameData = data.dates.filter(date => {
        const gameDate = new Date(date.date);
        let currentDate = new Date();
        currentDate.setDate(currentDate.getDate() - 1);
        const march30th = new Date('2023-03-30');
        return gameDate >= march30th && gameDate <= currentDate;
      });

    let  gameIds = [];
    for(const game of gameData) {
        for(const g of game.games) {
            //Ignore postponed games
            if (g.rescheduleDate) continue;

            let homeAway = '';
            g.teams.away.team.id === teamId ? homeAway = 'top' : homeAway = 'bottom';

            gameIds.push({id: g.gamePk, teamId: teamId, homeAway: homeAway});
        }
    }

    const result = await findHomers(gameIds, teamId);
    return result;
}

const getMLBTotals = (data) => {
    let homeRunRBITotal = 0;
    let overallRBITotal = 0;
    
    for(const team of data) {
        homeRunRBITotal += team.homerRBI;
        overallRBITotal += team.totalRBI;
    }

    const GN = ((homeRunRBITotal / overallRBITotal) * 100);
    return {teamName: 'MLB', homerRBI: homeRunRBITotal, totalRBI: overallRBITotal, GuillenNumber: GN, currentDate: new Date()};

}

const getGuillenNumbers = async (first, last) => { 
    if (parseInt(first) === 0) {
        const emptyData = [];
        const emptyDataJson = JSON.stringify(emptyData);
        fs.writeFileSync('./tempdata.json', emptyDataJson, 'utf8');
    }
    
    let result = [];
    for (let i = parseInt(first); i <= parseInt(last); i++) {
        result.push(await getGameData(mlbTeams[i].id, 2023));
    }

    let tempData;
    fs.readFileSync('./tempdata.json', (error, data) => {
        if(error){
           console.log(error);
           return;
        }
        tempData = JSON.parse(data);
        tempData.push(...result);


        const json = JSON.stringify(tempData);
        fs.writeFileSync("tempdata.json", json, (error) => {
            if (error) {
                console.error(error);
                throw error;
            }
        });    
    });
}

const buildJSON = async () => {
    console.log('hello I am here');
    let sortedData;
    fs.readFileSync('./tempdata.json', (error, data) => {
        if(error){
            console.log(error);
            return;
        }
        sortedData = JSON.parse(data);
        
        sortedData.push(getMLBTotals(sortedData));
        sortedData.sort((a, b) => b.GuillenNumber - a.GuillenNumber);


        const json = JSON.stringify(sortedData);
        fs.writeFileSync("data.json", json, (error) => {
            if (error) {
                console.error(error);
                throw error;
            }
        });    
    });
}


module.exports = router;


