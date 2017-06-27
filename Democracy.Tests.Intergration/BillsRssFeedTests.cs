using System;
using Democracy.Bills;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace Democracy.Tests.Intergration
{
    [TestClass]
    public class BillsRssFeedTests
    {
        [TestMethod]
        public void GetListOfBills()
        {
            var rssClient = new RssClient();
            var billsData = rssClient.GetBills("http://services.parliament.uk/bills/AllBills.rss");
            Assert.IsTrue(billsData.Count > 0);
            
        }
    }
}
