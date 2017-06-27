using System.Collections.Generic;

namespace Democracy.Bills.Models
{
    public class TWFYMPResults
    {
        public string member_id { get; set; }
        public string person_id { get; set; }
        public string name { get; set; }
        public string party { get; set; }
        public string constituency { get; set; }

        public List<TWFYOfficeResult> offices { get; set; }
    }
}