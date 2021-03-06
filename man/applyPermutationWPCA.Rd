% Generated by roxygen2: do not edit by hand
% Please edit documentation in R/Projections.R
\name{applyPermutationWPCA}
\alias{applyPermutationWPCA}
\title{Applies pemutation method to return the most significant components of PCA data}
\usage{
applyPermutationWPCA(expr, components = 50, p_threshold = 0.05)
}
\arguments{
\item{expr}{Expression data}

\item{components}{Maximum components to calculate. Default is 50.}

\item{p_threshold}{P Value to cutoff components at. Default is .05.}
}
\value{
(list):
\itemize{
    \item wPCA: weighted PCA data
    \item eval: the proortinal variance of each component
    \item evec: the eigenvectors of the covariance matrix
    \item permuteMatrices: the permuted matrices generated as the null distrbution
}
}
\description{
Applies pemutation method to return the most significant components of PCA data
}
\details{
Based on the method proposed by Buja and Eyuboglu (1992), PCA is performed on the data
then a permutation procedure is used to assess the significance of components
}
