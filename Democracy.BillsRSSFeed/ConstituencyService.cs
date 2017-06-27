using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Democracy.Bills.Models;
using Democracy.Data.DataModels;
using Democracy.Data.Interfaces;
using Democracy.Models;
using Newtonsoft.Json;

namespace Democracy.Bills
{
    public class ConstituencyService : IConstituencyService
    {
        private readonly IDatabaseRepository _db;

        public ConstituencyService(IDatabaseRepository db)
        {
            _db = db;
        }

        public ConstituencyDataModel GetConstituency(string postcode)
        {
            var theyWorkForYouApi = new Democracy.TheyWorkForYou.API();
            string result = theyWorkForYouApi.Query("getConstituency",
                new string[] { "postcode:" + postcode });

            var constituancy = JsonConvert.DeserializeObject<TWFYConstituencies>(result);

            return _db.Single<ConstituencyDataModel>(c => c.Name == constituancy.name);

        }

        public ApplicationUser GetUserWithConstituency(string id)
        {
            return _db.SingleIncluding<ApplicationUser>(u => u.Id == id, u => u.ConstituencyDataModel);
        }

    }
}
