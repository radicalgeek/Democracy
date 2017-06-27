using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using Democracy.Bills.Models;
using Democracy.Data.DataModels;
using Democracy.Data.Interfaces;
using Democracy.Models;
using Democracy.Services.Contracts.ViewModels;
using Newtonsoft.Json;

namespace Democracy.Bills
{
    public class DebatesService : IDebatesService
    {
        private readonly IDatabaseRepository _db;
        private readonly IBillsService _billsService;

        public DebatesService(IDatabaseRepository db, IBillsService billsService)
        {
            _db = db;
            _billsService = billsService;
        }

        public BillPeoplesDebateViewModel GetPeoplesDebatesByBill(int billId)
        {
            
            var postsForBillData = _db.AllIncluding<PeoplesDebatPostDataModel>(p => p.BillDataModel).Where(post => post.BillDataModelId == billId).ToList();
            var bill = _db.Single<BillDataModel>(b => b.Id == billId);

            var posts = postsForBillData.Select(post => new PeoplesDebatePostViewModel().MapFromDataObject(post)).ToList();

            var debate = new BillPeoplesDebateViewModel
            {
                Posts = posts.OrderBy(post => post.Date).ToList(),
                Title = bill.Title,
                BillId = billId
            };

            return debate;
        }

        public void AddPeoplesComment(string userId, string newComment, string billId)
        {
            var realBillId = Convert.ToInt32(billId);
            var user = _db.Single<ApplicationUser>(u => u.Id == userId);
            var bill = _db.Single<BillDataModel>(billDataModel => billDataModel.Id == realBillId);

            var billCommentDataModel = new PeoplesDebatPostDataModel()
            {
                Date = DateTime.Now,
                Author = user,
                BillDataModelId = bill.Id,
                Text = newComment
            };

            _db.Add<PeoplesDebatPostDataModel>(billCommentDataModel);
            _db.CommitChanges();

        }

        public void GetCommonsDebatesByill(int billId)
        {

            var bill = _db.Single<BillDataModel>(b => b.Id == billId);
            var query = PrepareQuery(bill);

            var theyWorkForYouApi = new TheyWorkForYou.API();
            string rawResults = theyWorkForYouApi.Query("getDebates", new string[] { "type:commons", "num:10000", "order:d", "search:\"" + query + "\"" });
            //string result2 = theyWorkForYouApi.Query("getDebates", new string[] { "type:westminsterhall", "search:" + bill.Title });
            //string result3 = theyWorkForYouApi.Query("getDebates", new string[] { "type:lords", "search:" + bill.Title });
            //string result4 = theyWorkForYouApi.Query("getDebates", new string[] { "type:scotland", "search:" + bill.Title });
            //string result5 = theyWorkForYouApi.Query("getDebates", new string[] { "type:northernireland", "search:" + bill.Title });

            var commonsResults = JsonConvert.DeserializeObject<TWFYDebateSearchResults>(rawResults);

            var filterResults = commonsResults.rows.Where(result => result.parent.body.ToLower().Contains(query.Trim())).ToList();

        }

        private static string PrepareQuery(BillDataModel bill)
        {
            string searchTerm = bill.Title;
            if (bill.Title.Contains("Act"))
            {
                searchTerm = searchTerm.ToLower().Replace("act", "bill");
                searchTerm = Regex.Replace(searchTerm, @"\d+$", String.Empty);
            }
            return searchTerm;
        }
    }
}
