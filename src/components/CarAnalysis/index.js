'use client';

import { useState, useEffect } from "react";
import { Radar, RadarChart, LabelList, PolarGrid, PolarAngleAxis } from 'recharts';
// import analysis from './analysis';
import axios from 'axios';
import _ from 'lodash';
// import { load } from "cheerio";

const Star = ()=>(<svg fill='#593CFB' className="inline" xmlns="http://www.w3.org/2000/svg" width="24px" height="24px" viewBox="0 0 24 24" role="img" version="1.1"><path d="m15.153 8.498 5.906.41c.904.064 1.274 1.197.582 1.783l-4.52 3.835 1.377 5.72c.212.88-.746 1.576-1.514 1.1L12 18.25l-4.983 3.095c-.77.477-1.727-.22-1.515-1.098l1.379-5.72-4.516-3.829c-.696-.582-.334-1.716.568-1.787l5.907-.413 2.226-5.373c.345-.833 1.522-.833 1.866 0l2.22 5.373Z"></path></svg>)

export default function CarAnalysis({json={}}) {
  const [data, setData] = useState(json);
  const [scores, setScores] = useState({})
  const [suggestions, setSuggestions] = useState([])
  const [description, setDescription] = useState('')
  const [generatingDescription, setGeneratingDescription] = useState(false)
  const [userPromt, setUserPromt] = useState('')
  const [loadingSteps, setLoadingSteps] = useState([
    'Fetching original description...',
    'Loading the car locations...',
    'Find point of interest nearby...',
    'Checking car facts...',
    'Look for extra features...',
    'Loading host profile...',
    'Checking car history...',
    'Check overall analysis...',
  ]);
  const [currentStep, setCurrentStep] = useState(-1);
  useEffect(()=>{
    console.log('json', json)
    setData(json)
  }, [json])
  useEffect(() => {
    const result = {
      overall: [
        {
          point: 'Car Features',
          score: 0,
          fullMark: 100,
        },
        {
          point: 'Post Quality',
          score: 0,
          fullMark: 100,
        },
        {
          point: 'Host Profile',
          score: 0,
          fullMark: 100,
        },
        {
          point: 'Hospitality',
          score: 0,
          fullMark: 100,
        },
        {
          point: 'Credibility',
          score: 0,
          fullMark: 100,
        },
      ]
    }
    _.find(result.overall, {point: 'Car Features'}).score = Math.round(100*
      (
        (data?.vehicleDetail?.extras.extras.length > 10 ? 1 : data?.vehicleDetail?.extras.extras.length/10)+
        (data?.vehicleDetail?.highValueVehicle? 1 : 0.6)+
        (data?.vehicleDetail?.basicCarDetails.averageFuelEconomy/30)
      )/3
    );
    _.find(result.overall, {point: 'Post Quality'}).score = data?.vehicleDetail?.images.length*5;
    _.find(result.overall, {point: 'Credibility'}).score = Math.round(100*
      (
        (data?.vehicleDetail?.ratings.ratingToHundredth/5)+
        (data?.vehicleDetail?.vehicle.listingCreatedTime/1673529631000)+
        (data?.vehicleDetail?.tripCount/30)
      )/3
    );
    _.find(result.overall, {point: 'Host Profile'}).score = Math.round(100*
      (
        (data?.vehicleDetail?.numberOfRentals/20)+
        (data?.vehicleDetail?.numberOfReviews/20)+
        (data?.vehicleDetail?.owner.allStarHost? 1 : 0.8)+
        (data?.vehicleDetail?.owner.proHost? 1 : 0.8)
      )/4
    );
    _.find(result.overall, {point: 'Hospitality'}).score = Math.round(100*
      (data?.vehicleDetail?.rate.dailyDistance.scalar/400)+ // 200 miles/400 miles
      (data?.vehicleDetail?.rate.airportDeliveryLocationsAndFees.length/3) // 1 airport/3 airports
    ); 
    setScores(result.overall)
  }, [data])

  useEffect(()=>{
    const localSuggestions = [];
    if(data?.vehicleDetail?.rate.dailyDistance.scalar < 400) {
      localSuggestions.push('Daily distance limit is too low, suggest to set Unlimited miles or at least 300 miles/day')
    }
    if(data?.vehicleDetail?.rate.airportDeliveryLocationsAndFees.length<3) {
      localSuggestions.push(`Airport delivery location options too less, suggest to add ${3-data?.vehicleDetail?.rate.airportDeliveryLocationsAndFees.length} more options`)
    }
    if(data?.vehicleDetail?.extras.extras.length<10) {
      localSuggestions.push(`Lack of extra options, suggest to add ${10-data?.vehicleDetail?.extras.extras.length} more options.`)
    }
    if(data?.vehicleDetail?.description.length<2000) {
      localSuggestions.push(`Description are too short and not detail enough, suggest to 2 more paragraph on what kind of trip this car is good for.`)
    }
    if(!data?.vehicleDetail?.instantBookLocationPreferences.homeLocationEnabled) {
      localSuggestions.push(`Suggest to turn on instant booking for home location.`)
    }
    if(!data?.vehicleDetail?.instantBookLocationPreferences.poiLocationEnabled) {
      localSuggestions.push(`Suggest to turn on instant booking for nearby point of interest locations.`)
    }
    setSuggestions(localSuggestions)
  }, [data])

  const improveDescription = () => {
    setUserPromt(userPromt + '\n Improve from my existing description: \n' + data?.vehicleDetail?.description)
    generateDescription()
  }

  const generateDescription = () => {
    changeLoadingStates()
    setGeneratingDescription(true)
    const apiKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY;
    const originalDescription = data?.vehicleDetail?.description
    const apiUrl = 'https://api.openai.com/v1/chat/completions';
    if(originalDescription){
      const prompt = `
Refine and reword or generate the Turo car profile description in plain text with breaking lines and bullet points.

Use some emojis for an attractive description.

The car is a ${data?.vehicleDetail?.vehicle.year} ${data?.vehicleDetail?.vehicle.make} ${data?.vehicleDetail?.vehicle.model} ${data?.vehicleDetail?.vehicle.trim}.

Find point of interest like winery, ski resorts or beaches that's about 200 miles from ${data?.vehicleDetail?.location.city}, ${data?.vehicleDetail?.location.state}, ${data?.vehicleDetail?.location.country} and maybe add them to the content.

Include at least four paragraphs in the return part, but only plain text, no bolded text or any styles is needed for each paragraph.
Ensure the paragraph includes information on "features provided by the car," "Why it's the Best Choice for short trips and long trips," and "Why Turo with Us."

Here is the extra request that can override my above request: ${userPromt}
`;
 console.log(prompt)
    axios.post(apiUrl, {
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'system', content: 'You are a helpful assistant.' }, { role: 'user', content: prompt }],
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
    })
      .then(response => {
        console.log(response.data)
        const generatedDescription = response.data?.choices[0].message.content;
        // Use the generatedDescription in your React app JSX code
        setDescription(generatedDescription)
        setGeneratingDescription(false)
      })
      .catch(error => {
        console.error('Error calling OpenAI Chat API:', error);
        setDescription(<>Failed</>)
        setGeneratingDescription(false)
      });
  }
}

  const changeLoadingStates = async () => {
    for (let i = 0; i < loadingSteps.length; i++) {
      setCurrentStep(i);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    setGeneratingDescription(false)
  };

  return (<div className='bg-gray-0 w-[830px] rounded-3xl p-4'>
    <div className='text-3xl font-bold mb-2'>AI assistants</div>
    <div className="p-8 rounded-xl bg-gray-100">
      <div className='flex py-2 flex-row items-center'><Star /> <span className="font-bold text-xl">Assist on Description</span></div>
      <textarea className='h-[100px] border-2 p-2 px-4 w-full block rounded-lg' placeholder="Some extra thing you want the AI to know about" value={userPromt} onChange={(e)=>setUserPromt(e.target.value)} />
      <div className="flex items-center">
        <button className="block mx-auto border-2 border-[#593CFB] text-[#593CFB] p-2 rounded-lg px-8 m-4 font-semibold hover:opacity-80 disabled:opacity-80" disabled={generatingDescription} onClick={()=>improveDescription()}>
          Improve the existing description
        </button>
        or
        <button className="block mx-auto bg-[#593CFB] text-white p-2 rounded-lg px-8 m-4 font-semibold hover:opacity-80 disabled:opacity-80" disabled={generatingDescription} onClick={()=>generateDescription()}>
          {generatingDescription ? 'Working...':'Generate Description from scratch'}
        </button>
      </div>
      {generatingDescription && <div className="flex w-full p-2 rounded-2xl flex-col mx-auto text-center">
        <img className="w-96 rounded-xl mx-auto" src="https://resources.turo.com/client/v2/builds/assets/il_car_on_the_desert79819cb36088b27926fa.png" />
        <div className='font-bold text-2xl mb-2'>AI is working very hard</div>
        <div className='font-light text-md'>{loadingSteps[currentStep]}</div>
      </div>}
      {description.length>0 && <div className="flex w-full p-2 rounded-2xl flex-wrap bg-purple-100">
        {description.split('\n').map((paragraph, index) => (<div key={index} className="rounded-xl font-md p-2">{paragraph}</div>))}
      </div>}
    </div>
    <div className='py-12' />
    <div className='text-3xl font-bold mb-2'>Analyzer</div>
    <div className="p-2 rounded-xl bg-gray-50">
      <div className='flex py-2 flex-row items-center font-bold text-xl'><Star />Photos Overview</div>
      <div className="flex w-full p-2 rounded-2xl flex-wrap">
        {data?.vehicleDetail?.images.map((image, index) => {
          return <img className="rounded-xl m-2" key={index} src={image.thumbnails["170x125"]} />
        })}
      </div>
    </div>
    <div className="pt-8 p-2 rounded-xl">
      <div className='flex py-2 flex-row items-center font-bold text-xl'><Star />Overall Scores</div>
      <RadarChart outerRadius={150} width={600} height={400} data={scores}>
        <PolarGrid />
        <PolarAngleAxis fill="#000" dataKey="point" />
        <Radar name={data?.vehicleDetail?.vehicle.name} dataKey="score" fill="#593CFB" fillOpacity={1}>
          <LabelList dataKey="score" angle="0" fill="#000" />
        </Radar>
      </RadarChart>
    </div>
    <div className="p-2 rounded-xl">
      <div className='flex py-2 flex-row items-center font-bold text-xl'><Star />Suggestions</div>
      <div className="flex w-full p-2 rounded-2xl flex-wrap">
        {(suggestions).map((suggestion, index) => (<div key={index} className="rounded-xl font-md p-2">{suggestion}</div>))}
      </div>
    </div>
  </div>)
}