using System.Collections.Generic;

namespace Democracy.Bills.Models
{
    public class TWFYDebateSearchResults
    {
        public SearchInfo info { get; set; }
        public string searchdescription { get; set; }

        public List<TWFTDebate> rows { get; set; }
    }
}