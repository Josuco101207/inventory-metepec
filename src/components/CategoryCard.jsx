import React from 'react';
import './CategoryCard.css';

const CategoryCard = ({ title, count, icon, color, trend, onClick }) => {
  return (
    <div 
      className={`category-card card animate-fade-in ${onClick ? 'cursor-pointer hover:shadow-lg' : ''}`} 
      style={{ '--card-color': color }}
      onClick={onClick}
    >
      <div className="category-header flex justify-between items-center mb-4">
        <div className="icon-wrapper flex items-center justify-center">
          {icon}
        </div>
        <span className={`trend-badge ${trend > 0 ? 'positive' : 'negative'}`}>
          {trend > 0 ? '+' : ''}{trend}%
        </span>
      </div>
      
      <div className="category-info">
        <h3 className="text-muted text-sm mb-1">{title}</h3>
        <p className="text-xl count-value">{count}</p>
      </div>
    </div>
  );
};

export default CategoryCard;
