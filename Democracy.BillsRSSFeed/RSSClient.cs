using System;
using System.Collections.Generic;
using System.Linq;
using System.Net;
using System.ServiceModel.Syndication;
using System.Text;
using System.Threading.Tasks;
using System.Xml;
using System.Xml.Linq;
using Democracy.Data.DataModels;

namespace Democracy.Bills
{
    public interface IRssClient
    {
        List<BillDataModel> GetBills(string url);
    }

    public class RssClient : IRssClient
    {
        public List<BillDataModel> GetBills(string url)
        {
            var bills = new List<BillDataModel>();
            var reader = XmlReader.Create(url);
            var feed = SyndicationFeed.Load(reader);
            reader.Close();
            if (feed != null)
                bills.AddRange(feed.Items.Select(item => new BillDataModel
                {
                    Title = item.Title.Text, 
                    Description = item.Summary.Text, 
                    UpdatedDate = item.LastUpdatedTime.DateTime, 
                    BillType = item.Categories[1].Name, 
                    House = item.Categories[0].Name, 
                    Url = item.Id, 
                    Stage = item.AttributeExtensions.First().Value
                }));
            return bills;
        }

    }

   
}
