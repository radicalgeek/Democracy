using System.ComponentModel.DataAnnotations;
using System.Runtime.Serialization;

namespace Democracy.Data.DataModels
{
    public enum PartyDataModel
    {
        [Display(Name = "Conservative")]
        Conservative = 1,
        [Display(Name = "Labour")]
        Labour = 2,
        [Display(Name = "Liberal Democrat")]
        LibDem = 3,
        [Display(Name = "Green")]
        Green = 4,
        [Display(Name = "UKIP")]
        UKIP = 5,
        [Display(Name = "DUP")]
        DUP = 6,
        [Display(Name = "Social Democratic and Labour Party")]
        SDL = 7,
        [Display(Name = "Sinn Fein")]
        SinnFain = 8,
        [Display(Name = "Respect")]
        Respect = 9,
        [Display(Name = "Plaid Cymru")]
        PalidCyeru = 10,
        [Display(Name = "UUP")]
        UUP = 11,
        [Display(Name = "independent")]
        Independent = 13,
        [Display(Name = "Scottish National Party")]
        SNP = 14,
        [Display(Name = "Deputy Speaker")]
        DS = 15,
        [Display(Name = "Independent Labour")]
        IndependentLabour = 16,
        [Display(Name = "Speaker")]
        Speaker = 17,
        [Display(Name = "Alliance")]
        Alliance = 18
    }
}