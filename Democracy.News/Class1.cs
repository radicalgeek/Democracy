using System;
using System.Collections.Generic;
using System.Linq;
using System.ServiceModel.Syndication;
using System.Text;
using System.Threading.Tasks;
using System.Xml;

namespace Democracy.News
{
    public class Class1
    {
        public void GetNews()
        {
            SyndicationFeed mainFeed = new SyndicationFeed();
            List<string> feeds = new List<string>();

            feeds.Add("http://www.theguardian.com/uk/rss");
            feeds.Add("http://www.ft.com/rss/home/uk");
            feeds.Add("http://www.telegraph.co.uk/news/uknews/rss");
            feeds.Add("http://www.scotsman.com.dynamic.feedsportal.com/pf/610141/www.scotsman.com/rss/cmlink/1.2564253");
            feeds.Add("http://www.standard.co.uk/home/rss/");
            feeds.Add("http://www.standard.co.uk/home/rss/");
            feeds.Add("http://www.standard.co.uk/home/rss/");
            feeds.Add("http://www.standard.co.uk/home/rss/");
            feeds.Add("http://www.standard.co.uk/home/rss/");
            feeds.Add("http://www.standard.co.uk/home/rss/");

            foreach (var feed in feeds)
            {
                Uri feedUri = new Uri(feed); SyndicationFeed syndicationFeed;
                using (XmlReader reader = XmlReader.Create(feedUri.AbsoluteUri))
                {
                    syndicationFeed = SyndicationFeed.Load(reader);
                }
                syndicationFeed.Id = feed;

                SyndicationFeed tempFeed = new SyndicationFeed(
                    mainFeed.Items.Union(syndicationFeed.Items).OrderByDescending(u => u.PublishDate));

                mainFeed = tempFeed;
            }
        }
    }
}
