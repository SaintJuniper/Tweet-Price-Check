import { DatePipe } from '@angular/common';
import { Component } from '@angular/core';
import { connectableObservableDescriptor } from 'rxjs/internal/observable/ConnectableObservable';
import { ApiHandleService } from './shared/api-handle.service';
import { TwitterHandleService } from './shared/twitter-handle.service';
import { TwitterPostService } from './shared/twitter-post.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
})
export class AppComponent {
  title = 'pricecheck';
  finalCoinIds: string[] = [];
  mappedSymbols: any = {};
  allCoinIds: any = [];
  coinValues = [];
  initialInvestment: number = 100;
  totalPercentDifference: number = 0;

  twitterPostURL = '';
  tweetId = '1393021076754599939';

  tweet: { date: string; username: string; text: string } = {
    username: '',
    text: '',
    date: '',
  };

  constructor(
    private apiService: ApiHandleService,
    private twitterService: TwitterHandleService,
    private twitterPostService: TwitterPostService
  ) {}

  ngOnInit() {
    this.apiService.getAllCoins().subscribe((data) => {
      data.forEach((coin) => {
        this.mappedSymbols[coin.symbol] = coin.id;
        this.allCoinIds.push(coin.id);
      });
    });
  }

  // getPing() {
  //   this.apiService.getPing().subscribe((data) => (this.response = data));
  // }

  // getPrices() {
  //   this.getPriceAtDate(this.cryptoId, this.date);
  //   this.getCurrentPrice();
  // }

  // getPriceAtDate(id, date) {
  //   this.apiService.getPriceOfCoinAtDate(id, date).subscribe((data) => {
  //     return data['market_data']['current_price']['usd'];
  //   });
  // }

  // getCurrentPrice() {
  //   this.apiService.getCurrentPrice(this.cryptoId).subscribe((data) => {
  //     this.currentPrice = data['market_data']['current_price']['usd'];
  //   });
  // }

  getTwitterPost() {
    console.log(`attempting to get twitter post ${this.tweetId}`);

    // Get tweet id from the twitter post URL
    this.tweetId = this.twitterPostURL.split('/').pop();

    this.twitterService.getTweet(this.tweetId).subscribe((data) => {
      // Gets the username of the tweeter
      this.tweet.username = data['includes']['users'][0]['username'];

      // Gets the text of the tweet
      this.tweet.text = data['data'][0]['text'];

      // Get the date in 03-05-2020 form
      const datePipe = new DatePipe('en-US');
      this.tweet.date = datePipe.transform(
        data['data'][0]['created_at'],
        'dd-MM-yyyy'
      );

      // Once loaded, analyse tweet
      this.analyseTweet();
    });
  }

  analyseTweet() {
    // extract coin info from tweet text
    this.loadTickers();

    // evaluate coins at tweet date compared to current date
    this.getCurrentEvaluation();
  }

  herokuFetch() {
    let postId = '1393956950078021632';
    this.twitterPostService.getTweet(postId).subscribe((data) => {
      console.log(data);
    });
  }

  // tweet text -> load ids into finalCoinIds
  loadTickers() {
    // Matches all tickers in tweet text e.g. $XRP, $BTC
    const regex = /(^|\s)[\$|\#]([A-Za-z_][A-Za-z0-9_]*)/gm;
    const foundTickers = this.tweet.text.match(regex);

    // Checks tickers exist as a coin in database, load ids of each coin
    for (let ticker of foundTickers) {
      let splicedTicker = ticker
        .replace(/(^\s+|\s+$)/g, '')
        .substring(1)
        .toLowerCase();
      // checks ticker usage and maps it to relevant id e.g. #XRP -> 'ripple'
      if (splicedTicker in this.mappedSymbols) {
        this.finalCoinIds.push(this.mappedSymbols[splicedTicker]);
      } else {
        // checks if the id exists e.g. usage of #bitcoin -> 'bitcoin'
        if (this.allCoinIds.includes(splicedTicker)) {
          this.finalCoinIds.push(splicedTicker);
        }
      }
    }

    // remove duplicates
    this.finalCoinIds = [...new Set(this.finalCoinIds)];

    console.log(`Final coin Ids: ${this.finalCoinIds}`);
  }

  getCurrentEvaluation() {
    console.log(`Attempting to evaluate difference in value of coins `);

    this.coinValues = [];
    this.totalPercentDifference = 0;

    let investmentPerCoin = this.initialInvestment / this.finalCoinIds.length;
    // let investmentPerCoin = 100;

    for (let coin of this.finalCoinIds) {
      this.apiService
        .getPriceOfCoinAtDate(coin, this.tweet.date)
        .subscribe((oldData) => {
          if (oldData['market_data'] == undefined) {
            console.log(`${coin} returned undefined`);
          } else {
            this.apiService.getCurrentPrice(coin).subscribe((data) => {
              if (data['market_data'] == undefined) {
                console.log(`${coin} returned undefined`);
              } else {
                // Price at tweet date
                let oldCoinPrice =
                  oldData['market_data']['current_price']['usd'];
                // Price at current date
                let currentCoinPrice =
                  data['market_data']['current_price']['usd'];

                // Percent difference
                let percentDifference =
                  100 * (currentCoinPrice / oldCoinPrice) - 100;

                this.coinValues.push({
                  name: coin,
                  priceAtDate: oldCoinPrice,
                  currentPrice: currentCoinPrice,
                  percentDifference: percentDifference,
                });

                // Tally percent differenes
                this.totalPercentDifference += percentDifference;
                console.log(
                  `total percent difference: ${this.totalPercentDifference}`
                );
              }
            });
          }
        });
    }
  }
}
